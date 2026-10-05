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

/** Date et heure à Dakar, ex. « 05/10/2026 14:30 ». */
export const dateHeureFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Africa/Dakar',
    dateStyle: 'short',
    timeStyle: 'short',
  });

// --- Appareils ---

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
  qrCode: string;
  codeCourt: string;
  statut: StatutAppareil;
  aPhoto: boolean;
  creeLe: string;
  eleve: {
    id: string;
    matricule: string;
    prenoms: string;
    nom: string;
    statut: StatutEleve;
    classe: { id: string; nom: string } | null;
  };
}

export interface AppareilDetail extends Appareil {
  incidents: {
    id: string;
    type: TypeSignalement;
    dateHeure: string;
    lieu: string | null;
    commentaire: string | null;
    auteur: { prenoms: string; nom: string; role: Role } | null;
  }[];
}

export interface AppareilScanne extends AppareilDetail {
  tuteurs: {
    prenoms: string;
    nom: string;
    contact1: string;
    contact2: string | null;
    lien: LienTuteur;
    principal: boolean;
  }[];
}

export const LIBELLES_TYPE_APPAREIL: Record<TypeAppareil, string> = {
  TELEPHONE: 'Téléphone',
  TABLETTE: 'Tablette',
  ORDINATEUR: 'Ordinateur',
  AUTRE: 'Autre',
};

export const LIBELLES_STATUT_APPAREIL: Record<StatutAppareil, string> = {
  ACTIF: 'Actif',
  PERDU: 'Perdu',
  TROUVE: 'Trouvé',
  CONFISQUE: 'Confisqué',
  RESTITUE: 'Restitué',
};

export const LIBELLES_SIGNALEMENT: Record<TypeSignalement, string> = {
  DECLARE_PERDU: 'Déclaré perdu',
  TROUVE: 'Trouvé',
  CONFISQUE: 'Confisqué',
  RESTITUE: 'Restitué',
  USAGE_EN_CLASSE: 'Utilisé en classe',
};

/**
 * Signalements proposés selon le rôle et le statut (même règle que l'API,
 * qui reste seule juge : ceci évite seulement d'afficher des choix voués à l'échec).
 */
const REGLES_SIGNALEMENT: Record<
  TypeSignalement,
  { depuis: StatutAppareil[]; roles: Role[] }
> = {
  DECLARE_PERDU: {
    depuis: ['ACTIF', 'RESTITUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'SURVEILLANT', 'PARENT'],
  },
  TROUVE: {
    depuis: ['ACTIF', 'PERDU', 'RESTITUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'ENSEIGNANT', 'SURVEILLANT', 'COMPTABLE'],
  },
  CONFISQUE: {
    depuis: ['ACTIF', 'RESTITUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'ENSEIGNANT', 'SURVEILLANT'],
  },
  RESTITUE: {
    depuis: ['PERDU', 'TROUVE', 'CONFISQUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'SURVEILLANT'],
  },
  USAGE_EN_CLASSE: {
    depuis: ['ACTIF', 'RESTITUE'],
    roles: ['ADMIN', 'ENSEIGNANT', 'SURVEILLANT'],
  },
};

export const signalementsPossibles = (role: Role, statut: StatutAppareil) =>
  (Object.keys(REGLES_SIGNALEMENT) as TypeSignalement[]).filter(
    (t) =>
      REGLES_SIGNALEMENT[t].roles.includes(role) &&
      REGLES_SIGNALEMENT[t].depuis.includes(statut),
  );

/** « Téléphone Samsung Galaxy A15 noir » */
export const designationAppareil = (a: Appareil) =>
  [LIBELLES_TYPE_APPAREIL[a.type], a.marque, a.modele, a.couleur]
    .filter(Boolean)
    .join(' ');

// --- Notifications ---

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
export type CanalNotification = 'SMS' | 'EMAIL' | 'PUSH' | 'APPLICATION';
export type StatutNotification =
  'EN_FILE' | 'ENVOYEE' | 'DELIVREE' | 'ECHOUEE' | 'LUE';

export interface NotificationJournal {
  id: string;
  lotId: string;
  type: TypeNotification;
  canal: CanalNotification;
  priorite: 'URGENTE' | 'HAUTE' | 'NORMALE' | 'BASSE';
  statut: StatutNotification;
  destinataire: string;
  sujet: string | null;
  contenu: string;
  essais: number;
  erreur: string | null;
  fournisseur: string | null;
  cout: number | null;
  creeLe: string;
  envoyeeLe: string | null;
  delivreeLe: string | null;
  tuteur: { id: string; prenoms: string; nom: string };
  eleve: { id: string; prenoms: string; nom: string } | null;
}

export interface StatistiquesNotifications {
  mois: string;
  parCanal: Partial<
    Record<CanalNotification, Partial<Record<StatutNotification, number>>>
  >;
  sms: { envoyes: number; cout: number; plafond: number | null };
}

export interface ModeleCanal {
  canal: 'SMS' | 'EMAIL' | 'PUSH';
  personnalise: boolean;
  sujet: string | null;
  contenu: string;
  variables: string[];
  apercu: string;
  apercuSujet: string | null;
}

export interface ModeleType {
  type: TypeNotification;
  obligatoire: boolean;
  canauxParDefaut: CanalNotification[];
  canaux: ModeleCanal[];
}

export const LIBELLES_TYPE_NOTIFICATION: Record<TypeNotification, string> = {
  LIBERATION_ANTICIPEE: 'Libération anticipée',
  PAS_DE_COURS: 'Pas de cours',
  ABSENCE: 'Absence injustifiée',
  COMPORTEMENT: 'Comportement',
  RAPPEL_PAIEMENT: 'Rappel de paiement',
  RETARD_PAIEMENT: 'Retard de paiement',
  RECU_PAIEMENT: 'Reçu de paiement',
  RESULTATS: 'Résultats',
  DECISION_FIN_ANNEE: "Décision de fin d'année",
  EVENEMENT: 'Événement',
  USAGE_APPAREIL: "Usage d'appareil en classe",
  APPAREIL: 'Appareil',
};

export const LIBELLES_CANAL: Record<CanalNotification, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  PUSH: 'Push',
  APPLICATION: 'Application',
};

export const LIBELLES_STATUT_NOTIFICATION: Record<StatutNotification, string> =
  {
    EN_FILE: 'En file',
    ENVOYEE: 'Envoyée',
    DELIVREE: 'Délivrée',
    ECHOUEE: 'Échouée',
    LUE: 'Lue',
  };

// --- Annonces et absences ---

export type MotifAnnonce =
  | 'GREVE'
  | 'COUPURE_ELECTRICITE'
  | 'INTEMPERIES'
  | 'ABSENCE_ENSEIGNANT'
  | 'AUTRE';
export type StatutAnnonce = 'BROUILLON' | 'PROGRAMMEE' | 'ENVOYEE' | 'ANNULEE';
export type TypeAnnonce = 'PAS_DE_COURS' | 'LIBERATION_ANTICIPEE';

export interface Annonce {
  id: string;
  type: TypeAnnonce;
  titre: string;
  message: string;
  motif: MotifAnnonce | null;
  motifDetail: string | null;
  dateDebut: string;
  creneau: string | null;
  cible: 'ECOLE' | 'CLASSES';
  statut: StatutAnnonce;
  programmeeLe: string | null;
  envoyeeLe: string | null;
  creeLe: string;
  auteur: { prenoms: string; nom: string } | null;
  classes: { id: string; nom: string }[];
}

export interface AnnonceListe extends Annonce {
  familles: number;
  lues: number;
}

export interface AnnonceSuivie extends Annonce {
  suivi: {
    familles: number;
    lues: number;
    enCours: boolean;
    parCanal: Partial<
      Record<
        'SMS' | 'EMAIL' | 'PUSH',
        Partial<Record<StatutNotification, number>>
      >
    >;
    nonLues: {
      tuteur: { id: string; prenoms: string; nom: string; contact1: string };
      eleve: {
        id: string;
        prenoms: string;
        nom: string;
        classe: { nom: string } | null;
      } | null;
    }[];
  };
}

export const LIBELLES_MOTIF_ANNONCE: Record<MotifAnnonce, string> = {
  GREVE: 'Grève',
  COUPURE_ELECTRICITE: "Coupure d'électricité",
  INTEMPERIES: 'Intempéries',
  ABSENCE_ENSEIGNANT: "Absence d'enseignant",
  AUTRE: 'Autre (préciser)',
};

export const LIBELLES_STATUT_ANNONCE: Record<StatutAnnonce, string> = {
  BROUILLON: 'En cours d’envoi',
  PROGRAMMEE: 'Programmée',
  ENVOYEE: 'Envoyée',
  ANNULEE: 'Annulée',
};

export interface Absence {
  id: string;
  date: string;
  creneau: string;
  matiere: string | null;
  justifiee: boolean;
  motif: string | null;
  justificationParent: string | null;
  justifieeLe: string | null;
  creeLe: string;
  eleve: {
    id: string;
    matricule: string;
    prenoms: string;
    nom: string;
    classe: { id: string; nom: string } | null;
  };
  signalePar: { prenoms: string; nom: string; role: Role } | null;
  justifieePar: { prenoms: string; nom: string } | null;
}

/** Peut justifier ou supprimer une absence (vie scolaire). */
export const peutJustifier = (role: Role) =>
  role === 'ADMIN' || role === 'SECRETARIAT' || role === 'SURVEILLANT';

/** Peut faire l'appel. */
export const peutFaireAppel = (role: Role) =>
  peutJustifier(role) || role === 'ENSEIGNANT';

/** Date du jour à Dakar (AAAA-MM-JJ). */
export const aujourdHui = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(
    new Date(),
  );

// --- Résultats ---

export type DecisionFinAnnee = 'ADMIS' | 'REDOUBLE' | 'EXCLU' | 'ORIENTE';

export interface Periode {
  id: string;
  libelle: string;
  ordre: number;
}

export interface Matiere {
  id: string;
  nom: string;
  coefficient: number;
}

export interface Enseignement {
  matiere: Matiere;
  enseignant: { id: string; prenoms: string; nom: string } | null;
}

export interface Personne {
  id: string;
  prenoms: string;
  nom: string;
  role: Role;
}

export interface MesSaisies {
  enseignements: {
    classe: { id: string; nom: string };
    matiere: { id: string; nom: string };
    enseignant: { prenoms: string; nom: string } | null;
  }[];
  classesPrincipales: { id: string; nom: string }[];
}

export interface GrilleSaisie {
  classe: {
    id: string;
    nom: string;
    enseignantPrincipal: { id: string; prenoms: string; nom: string } | null;
  };
  periode: Periode;
  publie: boolean;
  publieLe: string | null;
  peutSaisirGeneral: boolean;
  peutPublier: boolean;
  matieres: (Matiere & {
    enseignant: { id: string; prenoms: string; nom: string } | null;
    peutSaisir: boolean;
    saisies: number;
  })[];
  eleves: {
    id: string;
    matricule: string;
    prenoms: string;
    nom: string;
    moyennes: Record<
      string,
      { moyenne: number | null; appreciation: string | null }
    >;
    resultat: {
      moyenne: number | null;
      rang: number | null;
      appreciation: string | null;
    } | null;
  }[];
}

export interface Decisions {
  classe: { id: string; nom: string; anneeScolaire: { libelle: string } };
  peutSaisir: boolean;
  peutPublier: boolean;
  publie: boolean;
  eleves: {
    id: string;
    prenoms: string;
    nom: string;
    decision: {
      decision: DecisionFinAnnee;
      moyenneAnnuelle: number | null;
      observation: string | null;
      publie: boolean;
    } | null;
  }[];
}

export interface ResultatsEleve {
  effectif: number;
  periodes: (Periode & {
    publie: boolean;
    resultat: {
      moyenne: number | null;
      rang: number | null;
      appreciation: string | null;
    } | null;
  })[];
  decision: { libelle: string; publie: boolean } | null;
}

export const LIBELLES_DECISION: Record<DecisionFinAnnee, string> = {
  ADMIS: 'Admis(e)',
  REDOUBLE: 'Redouble',
  EXCLU: 'Exclu(e)',
  ORIENTE: 'Orienté(e)',
};

/** « 14.5 » → « 14,50 » */
export const noteFr = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** « 14,5 » ou « 14.5 » → 14.5 ; vide → null ; illisible → NaN (refusé par l'API). */
export const lireNote = (valeur: FormDataEntryValue | null): number | null => {
  const texte =
    typeof valeur === 'string' ? valeur.trim().replace(',', '.') : '';
  return texte === '' ? null : Number(texte);
};
