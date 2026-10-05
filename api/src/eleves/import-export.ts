// Lecture et analyse des fichiers d'import d'élèves (CSV ou Excel), sans accès à la base.
import { BadRequestException } from '@nestjs/common';
import { REGEX_TELEPHONE, versE164 } from '../common/validation.js';
import { Genre, LienTuteur } from '../generated/prisma/enums.js';
import type { CreerEleveDto } from './eleves.dto.js';
import { erreurDateNaissance } from './eleves.regles.js';

export const COLONNES_IMPORT = [
  'prenoms',
  'nom',
  'genre',
  'date_naissance',
  'classe',
  'telephone',
  'tuteur_prenoms',
  'tuteur_nom',
  'lien_tuteur',
  'contact_tuteur_1',
  'contact_tuteur_2',
  'email_tuteur',
] as const;

export type ColonneImport = (typeof COLONNES_IMPORT)[number];

export const COLONNES_OBLIGATOIRES: ColonneImport[] = [
  'prenoms',
  'nom',
  'genre',
  'date_naissance',
  'tuteur_prenoms',
  'tuteur_nom',
  'contact_tuteur_1',
];

export const LIGNES_MAX_IMPORT = 2000;

/** « Date de naissance » → « date_de_naissance » : minuscules, sans accents. */
export const normaliserEntete = (entete: string): string =>
  entete
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const ALIAS: Record<string, ColonneImport> = {
  prenom: 'prenoms',
  sexe: 'genre',
  date_de_naissance: 'date_naissance',
  naissance: 'date_naissance',
  telephone_eleve: 'telephone',
  tuteur: 'tuteur_nom',
  tuteur_prenom: 'tuteur_prenoms',
  prenoms_tuteur: 'tuteur_prenoms',
  nom_tuteur: 'tuteur_nom',
  lien: 'lien_tuteur',
  contact_1: 'contact_tuteur_1',
  contact_2: 'contact_tuteur_2',
  contact_tuteur1: 'contact_tuteur_1',
  contact_tuteur2: 'contact_tuteur_2',
  email: 'email_tuteur',
};

/** Découpe un CSV (séparateur ; , ou tabulation détecté, guillemets gérés). */
export function parserCsv(texte: string): string[][] {
  const contenu = texte.replace(/^﻿/, '');
  const premiereLigne = contenu.split(/\r?\n/, 1)[0] ?? '';
  const separateur = [';', ',', '\t'].reduce((meilleur, s) =>
    premiereLigne.split(s).length > premiereLigne.split(meilleur).length
      ? s
      : meilleur,
  );

  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = '';
  let entreGuillemets = false;
  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];
    if (entreGuillemets) {
      if (c === '"' && contenu[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        champ += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenu[i + 1] === '\n') i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else {
      champ += c;
    }
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

export interface LigneImport {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  ligne: number;
  valeurs: Partial<Record<ColonneImport, string>>;
}

/** Associe les colonnes à l'en-tête et ignore les lignes vides. */
export function lireLignes(tableau: string[][]): LigneImport[] {
  const [entete, ...donnees] = tableau;
  if (!entete) throw new BadRequestException('Le fichier est vide.');

  const colonnes = entete.map((e) => {
    const nom = normaliserEntete(e);
    return (COLONNES_IMPORT as readonly string[]).includes(nom)
      ? (nom as ColonneImport)
      : ALIAS[nom];
  });
  const manquantes = COLONNES_OBLIGATOIRES.filter((c) => !colonnes.includes(c));
  if (manquantes.length) {
    throw new BadRequestException(
      `Colonnes obligatoires absentes : ${manquantes.join(', ')}. Téléchargez le modèle d'import.`,
    );
  }

  const lignes: LigneImport[] = [];
  donnees.forEach((cellules, index) => {
    if (cellules.every((c) => c.trim() === '')) return;
    const valeurs: LigneImport['valeurs'] = {};
    colonnes.forEach((colonne, i) => {
      const valeur = cellules[i]?.trim();
      if (colonne && valeur) valeurs[colonne] = valeur;
    });
    lignes.push({ ligne: index + 2, valeurs });
  });
  if (lignes.length > LIGNES_MAX_IMPORT) {
    throw new BadRequestException(
      `Le fichier contient ${lignes.length} lignes : ${LIGNES_MAX_IMPORT} au maximum par import.`,
    );
  }
  return lignes;
}

const sansAccents = (s: string) => normaliserEntete(s).replace(/_/g, ' ');

export function lireGenre(valeur: string): Genre | null {
  const v = sansAccents(valeur);
  if (['m', 'g', 'masculin', 'garcon', 'homme'].includes(v))
    return Genre.MASCULIN;
  if (['f', 'feminin', 'fille', 'femme'].includes(v)) return Genre.FEMININ;
  return null;
}

export function lireLien(valeur?: string): LienTuteur | null {
  if (!valeur) return LienTuteur.AUTRE;
  const v = sansAccents(valeur);
  if (v === 'pere') return LienTuteur.PERE;
  if (v === 'mere') return LienTuteur.MERE;
  if (['tuteur', 'tuteur legal', 'tutrice'].includes(v)) {
    return LienTuteur.TUTEUR_LEGAL;
  }
  if (v === 'autre') return LienTuteur.AUTRE;
  return null;
}

/** Accepte JJ/MM/AAAA, J/M/AAAA, JJ-MM-AAAA et AAAA-MM-JJ ; renvoie AAAA-MM-JJ. */
export function lireDate(valeur: string): string | null {
  const iso = /^(?<annee>\d{4})-(?<mois>\d{1,2})-(?<jour>\d{1,2})$/.exec(
    valeur,
  );
  const fr = /^(?<jour>\d{1,2})[/.-](?<mois>\d{1,2})[/.-](?<annee>\d{4})$/.exec(
    valeur,
  );
  const parties = (iso ?? fr)?.groups;
  if (!parties) return null;
  const { annee, mois, jour } = parties;
  return `${annee}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`;
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContexteAnalyse {
  /** Nom de classe normalisé → id, pour l'année active. */
  classes: Map<string, string>;
  indicatif?: string;
}

export interface LigneAnalysee {
  ligne: number;
  donnees?: CreerEleveDto;
  erreurs: string[];
}

/** Transforme une ligne du fichier en demande de création, ou liste ses erreurs. */
export function analyserLigne(
  { ligne, valeurs: v }: LigneImport,
  contexte: ContexteAnalyse,
  aujourdHui = new Date(),
): LigneAnalysee {
  const erreurs: string[] = [];
  const obligatoire = (colonne: ColonneImport, libelle: string) => {
    if (!v[colonne]) erreurs.push(`${libelle} manquant(e).`);
    return v[colonne] ?? '';
  };
  const telephone = (colonne: ColonneImport, libelle: string) => {
    const brut = v[colonne];
    if (!brut) return undefined;
    const numero = versE164(brut, contexte.indicatif);
    if (!REGEX_TELEPHONE.test(numero)) {
      erreurs.push(`${libelle} invalide : « ${brut} ».`);
    }
    return numero;
  };

  const prenoms = obligatoire('prenoms', 'Prénoms');
  const nom = obligatoire('nom', 'Nom');

  const genre = v.genre ? lireGenre(v.genre) : null;
  if (!v.genre) erreurs.push('Genre manquant.');
  else if (!genre) erreurs.push(`Genre invalide : « ${v.genre} » (M ou F).`);

  const dateNaissance = v.date_naissance ? lireDate(v.date_naissance) : null;
  if (!v.date_naissance) {
    erreurs.push('Date de naissance manquante.');
  } else if (!dateNaissance) {
    erreurs.push(
      `Date de naissance illisible : « ${v.date_naissance} » (JJ/MM/AAAA).`,
    );
  } else {
    const erreur = erreurDateNaissance(dateNaissance, aujourdHui);
    if (erreur) erreurs.push(erreur);
  }

  let classeId: string | undefined;
  if (v.classe) {
    classeId = contexte.classes.get(normaliserEntete(v.classe));
    if (!classeId) erreurs.push(`Classe inconnue : « ${v.classe} ».`);
  }

  const telephoneEleve = telephone('telephone', "Téléphone de l'élève");
  const tuteurPrenoms = obligatoire('tuteur_prenoms', 'Prénoms du tuteur');
  const tuteurNom = obligatoire('tuteur_nom', 'Nom du tuteur');
  const lien = lireLien(v.lien_tuteur);
  if (!lien) {
    erreurs.push(
      `Lien du tuteur invalide : « ${v.lien_tuteur} » (père, mère, tuteur ou autre).`,
    );
  }
  if (!v.contact_tuteur_1) erreurs.push('Contact_tuteur_1 manquant.');
  const contact1 = telephone('contact_tuteur_1', 'Contact_tuteur_1');
  const contact2 = telephone('contact_tuteur_2', 'Contact_tuteur_2');
  if (v.email_tuteur && !REGEX_EMAIL.test(v.email_tuteur)) {
    erreurs.push(`Email du tuteur invalide : « ${v.email_tuteur} ».`);
  }

  if (erreurs.length) return { ligne, erreurs };
  return {
    ligne,
    erreurs,
    donnees: {
      prenoms,
      nom,
      genre: genre!,
      dateNaissance: dateNaissance!,
      telephone: telephoneEleve,
      classeId,
      tuteurs: [
        {
          prenoms: tuteurPrenoms,
          nom: tuteurNom,
          contact1,
          contact2,
          email: v.email_tuteur?.toLowerCase(),
          lien: lien!,
          principal: true,
        },
      ],
    },
  };
}

/** Clé de doublon : même nom, mêmes prénoms, même date de naissance. */
export const cleEleve = (prenoms: string, nom: string, dateNaissance: string) =>
  `${normaliserEntete(prenoms)}|${normaliserEntete(nom)}|${dateNaissance}`;

/** Échappe une valeur pour un CSV à point-virgule (Excel en français). */
export const celluleCsv = (
  valeur: string | number | null | undefined,
): string => {
  const texte = valeur == null ? '' : String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};
