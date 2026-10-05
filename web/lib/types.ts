// Formes des réponses de l'API utilisées par le site.

export type Role =
  | 'ADMIN'
  | 'SECRETARIAT'
  | 'ENSEIGNANT'
  | 'SURVEILLANT'
  | 'COMPTABLE'
  | 'PARENT';
export type Genre = 'MASCULIN' | 'FEMININ';
export type LienTuteur = 'PERE' | 'MERE' | 'TUTEUR_LEGAL' | 'AUTRE';
export type StatutEleve = 'ACTIF' | 'ARCHIVE';

export interface Page<T> {
  elements: T[];
  total: number;
  page: number;
  parPage: number;
  pages: number;
}

export interface Profil {
  id: string;
  prenoms: string;
  nom: string;
  email: string | null;
  role: Role;
}

export interface Tuteur {
  id: string;
  prenoms: string;
  nom: string;
  contact1: string;
  contact2: string | null;
  email: string | null;
  langue: 'FR' | 'WO' | 'EN';
}

export interface TuteurDeLEleve extends Tuteur {
  lien: LienTuteur;
  principal: boolean;
}

export interface Eleve {
  id: string;
  matricule: string;
  prenoms: string;
  nom: string;
  genre: Genre;
  dateNaissance: string;
  age: number;
  telephone: string | null;
  statut: StatutEleve;
  dateInscription: string;
  classe: { id: string; nom: string; niveau: string } | null;
  tuteurs: TuteurDeLEleve[];
}

export interface EleveDetail extends Eleve {
  historiqueClasse: {
    classe: { id: string; nom: string };
    dateDebut: string;
    dateFin: string | null;
  }[];
}

export interface Classe {
  id: string;
  nom: string;
  niveau: string;
  effectif: number;
  anneeScolaire: { id: string; libelle: string; active: boolean };
  enseignantPrincipal: { id: string; prenoms: string; nom: string } | null;
}

export interface ClasseDetail extends Classe {
  eleves: {
    id: string;
    matricule: string;
    prenoms: string;
    nom: string;
    genre: Genre;
  }[];
}

export interface TuteurListe extends Tuteur {
  nombreEleves: number;
}

export interface TuteurDetail extends Tuteur {
  eleves: {
    id: string;
    matricule: string;
    prenoms: string;
    nom: string;
    statut: StatutEleve;
    classe: { id: string; nom: string } | null;
    lien: LienTuteur;
    principal: boolean;
  }[];
}

export interface RapportImport {
  simulation: boolean;
  totalLignes: number;
  valides: number;
  crees: number;
  erreurs: { ligne: number; messages: string[] }[];
}

export const LIBELLES_LIEN: Record<LienTuteur, string> = {
  PERE: 'Père',
  MERE: 'Mère',
  TUTEUR_LEGAL: 'Tuteur légal',
  AUTRE: 'Autre',
};

export const LIBELLES_ROLE: Record<Role, string> = {
  ADMIN: 'Direction',
  SECRETARIAT: 'Secrétariat',
  ENSEIGNANT: 'Enseignant',
  SURVEILLANT: 'Surveillant',
  COMPTABLE: 'Comptabilité',
  PARENT: 'Parent',
};

/** Rôles qui peuvent inscrire et modifier les dossiers. */
export const peutGerer = (role: Role) =>
  role === 'ADMIN' || role === 'SECRETARIAT';

/** « 2014-03-15 » → « 15/03/2014 ». */
export const dateFr = (jour: string) => jour.split('-').reverse().join('/');
