// Formes des réponses de l'API utilisées par l'application.

export type Role =
  | 'ADMIN'
  | 'SECRETARIAT'
  | 'ENSEIGNANT'
  | 'SURVEILLANT'
  | 'COMPTABLE'
  | 'PARENT'
  | 'SUPER_ADMIN';

export interface Utilisateur {
  id: string;
  prenoms: string;
  nom: string;
  role: Role;
  ecoleId: string;
  tuteurId?: string | null;
  /** Parent : texte d'information à accepter avant d'utiliser l'application. */
  consentement?: {
    version: string;
    texte: string[];
    accepte: boolean;
  } | null;
}

export interface Session {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: Utilisateur;
}

export interface Page<T> {
  elements: T[];
  total: number;
  page: number;
  parPage: number;
  pages: number;
}

export interface Enfant {
  id: string;
  matricule: string;
  prenoms: string;
  nom: string;
  classe: { id: string; nom: string } | null;
}

export type TypeNotification =
  | 'LIBERATION_ANTICIPEE'
  | 'PAS_DE_COURS'
  | 'ABSENCE'
  | 'COMPORTEMENT'
  | 'RAPPEL_PAIEMENT'
  | 'RETARD_PAIEMENT'
  | 'RECU_PAIEMENT'
  | 'RESULTATS'
  | 'DECISION_FIN_ANNEE'
  | 'EVENEMENT'
  | 'USAGE_APPAREIL'
  | 'APPAREIL';

export interface Notification {
  id: string;
  type: TypeNotification;
  priorite: 'URGENTE' | 'HAUTE' | 'NORMALE' | 'BASSE';
  sujet: string | null;
  contenu: string;
  creeLe: string;
  lueLe: string | null;
  sourceType: string | null;
  sourceId: string | null;
  eleve: { id: string; prenoms: string } | null;
}

export interface MesNotifications extends Page<Notification> {
  nonLues: number;
}

export interface Preference {
  type: TypeNotification;
  obligatoire: boolean;
  canauxDisponibles: ('SMS' | 'EMAIL' | 'PUSH')[];
  sms: boolean;
  email: boolean;
  push: boolean;
}

export interface ResultatsEleve {
  effectif: number;
  periodes: {
    id: string;
    libelle: string;
    ordre: number;
    publie: boolean;
    resultat: {
      moyenne: number | null;
      rang: number | null;
      appreciation: string | null;
    } | null;
    matieres?: {
      matiere: { id: string; nom: string; coefficient: number };
      moyenne: number | null;
      appreciation: string | null;
    }[];
  }[];
  decision: { libelle: string; publie: boolean } | null;
}

export interface Comportement {
  id: string;
  type: 'POSITIF' | 'NEGATIF';
  categorie: string;
  gravite: number;
  description: string;
  sanction: string | null;
  convocationLe: string | null;
  date: string;
  eleve: { id: string; prenoms: string };
}

export interface RappelPaiement {
  id: string;
  libelle: string;
  montant: number;
  dateEcheance: string;
  statut: 'EN_COURS' | 'REGLE';
  joursRetard: number;
  eleve: { id: string; prenoms: string };
}

export interface ListeRappels extends Page<RappelPaiement> {
  enAttente: { montant: number; eleves: number };
}

export interface Absence {
  id: string;
  date: string;
  creneau: string;
  matiere: string | null;
  justifiee: boolean;
  motif: string | null;
  justificationParent: string | null;
  eleve: { id: string; prenoms: string };
}

export type TypeAppareil = 'TELEPHONE' | 'TABLETTE' | 'ORDINATEUR' | 'AUTRE';
export type StatutAppareil =
  'ACTIF' | 'PERDU' | 'TROUVE' | 'CONFISQUE' | 'RESTITUE';
export type TypeSignalement =
  'DECLARE_PERDU' | 'TROUVE' | 'CONFISQUE' | 'RESTITUE' | 'USAGE_EN_CLASSE';

export interface Appareil {
  id: string;
  type: TypeAppareil;
  marque: string | null;
  modele: string | null;
  couleur: string | null;
  numeroSerie: string | null;
  imei: string | null;
  signesDistinctifs: string | null;
  codeCourt: string;
  statut: StatutAppareil;
  eleve: {
    id: string;
    prenoms: string;
    nom: string;
    matricule: string;
    classe: { id: string; nom: string } | null;
  };
}

export interface AppareilScanne extends Appareil {
  incidents: {
    id: string;
    type: TypeSignalement;
    dateHeure: string;
    commentaire: string | null;
  }[];
  tuteurs: {
    prenoms: string;
    nom: string;
    contact1: string;
    contact2: string | null;
    principal: boolean;
  }[];
}

export interface Evenement {
  id: string;
  titre: string;
  description: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  modalites: string | null;
  pieceJointe: 'PDF' | 'IMAGE' | null;
  demandeReponse: boolean;
  question: string | null;
  statut: 'BROUILLON' | 'PROGRAMMEE' | 'ENVOYEE' | 'ANNULEE';
  enfants: {
    id: string;
    prenoms: string;
    nom: string;
    classe: { nom: string } | null;
    reponse: boolean | null;
    commentaire?: string | null;
  }[];
}

export interface EleveTrouve {
  id: string;
  matricule: string;
  prenoms: string;
  nom: string;
  classe: { id: string; nom: string } | null;
}
