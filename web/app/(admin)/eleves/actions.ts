'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { EleveDetail, RapportImport } from '@/lib/types';

type Etat = EtatFormulaire | null;

/** Valeur texte d'un champ ; vide → undefined (champ facultatif non envoyé). */
const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const identite = (d: FormData) => ({
  prenoms: texte(d, 'prenoms'),
  nom: texte(d, 'nom'),
  genre: texte(d, 'genre'),
  dateNaissance: texte(d, 'dateNaissance'),
  telephone: texte(d, 'telephone'),
});

/** Tuteur saisi dans le formulaire, avec le préfixe de ses champs (tuteur1_, tuteur2_). */
const tuteur = (d: FormData, prefixe: string) => ({
  prenoms: texte(d, `${prefixe}prenoms`),
  nom: texte(d, `${prefixe}nom`),
  contact1: texte(d, `${prefixe}contact1`),
  contact2: texte(d, `${prefixe}contact2`),
  email: texte(d, `${prefixe}email`),
  lien: texte(d, `${prefixe}lien`) ?? 'AUTRE',
});

export async function creerEleve(_e: Etat, d: FormData): Promise<Etat> {
  const tuteurs = [tuteur(d, 'tuteur1_')];
  const second = tuteur(d, 'tuteur2_');
  if (second.prenoms || second.nom || second.contact1) tuteurs.push(second);

  let id = '';
  const erreur = await tenter(async () => {
    const eleve = await envoyerApi<EleveDetail>('/eleves', 'POST', {
      ...identite(d),
      classeId: texte(d, 'classeId'),
      dateInscription: texte(d, 'dateInscription'),
      tuteurs,
    });
    id = eleve.id;
  });
  if (erreur) return erreur;
  redirect(`/eleves/${id}`);
}

export async function modifierEleve(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}`, 'PATCH', {
      ...identite(d),
      // Facultatif : une valeur vide efface l'ancien numéro.
      telephone: texte(d, 'telephone') ?? null,
    }),
  );
  if (erreur) return erreur;
  redirect(`/eleves/${id}`);
}

export async function changerClasse(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}/changer-classe`, 'POST', {
      classeId: texte(d, 'classeId'),
      date: texte(d, 'date'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Classe changée.' };
}

export async function archiverEleve(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}/archiver`, 'POST', { motif: texte(d, 'motif') }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Élève archivé.' };
}

export async function restaurerEleve(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}/restaurer`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Élève restauré.' };
}

export async function ajouterTuteur(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}/tuteurs`, 'POST', {
      ...tuteur(d, ''),
      principal: d.get('principal') === 'on',
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Tuteur ajouté.' };
}

export async function retirerTuteur(
  id: string,
  tuteurId: string,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}/tuteurs/${tuteurId}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Tuteur retiré.' };
}

export interface EtatImport extends EtatFormulaire {
  rapport?: RapportImport;
}

export async function importerEleves(
  _e: EtatImport | null,
  d: FormData,
): Promise<EtatImport | null> {
  const fichier = d.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Choisissez un fichier .xlsx ou .csv.' };
  }
  const simulation = d.get('simulation') === 'on';
  const envoi = new FormData();
  envoi.set('fichier', fichier, fichier.name);

  let rapport: RapportImport | undefined;
  const erreur = await tenter(async () => {
    rapport = await envoyerApi<RapportImport>(
      `/eleves/import?simulation=${simulation}`,
      'POST',
      envoi,
    );
  });
  return erreur ?? { rapport };
}

/** Effacement des données d'un élève archivé (direction, irréversible). */
export async function effacerDonnees(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/eleves/${id}/effacer`, 'POST', {
      confirmation: texte(d, 'confirmation') ?? '',
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: "Données de l'élève effacées." };
}
