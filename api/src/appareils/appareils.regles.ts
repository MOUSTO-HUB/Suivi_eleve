// Règles de vie d'un appareil (cahier des charges, EF-13 à EF-15), sans accès à la base.
import {
  Role,
  StatutAppareil,
  TypeIncidentAppareil,
} from '../generated/prisma/enums.js';

interface RegleIncident {
  /** Statuts depuis lesquels le signalement est possible. */
  depuis: StatutAppareil[];
  /** Nouveau statut ; null = inchangé (usage en classe). */
  vers: StatutAppareil | null;
  /** Rôles autorisés à faire ce signalement. */
  roles: Role[];
}

const { ACTIF, PERDU, TROUVE, CONFISQUE, RESTITUE } = StatutAppareil;
const PERSONNEL: Role[] = [
  Role.ADMIN,
  Role.SECRETARIAT,
  Role.ENSEIGNANT,
  Role.SURVEILLANT,
  Role.COMPTABLE,
];

export const REGLES_INCIDENT: Record<TypeIncidentAppareil, RegleIncident> = {
  // Le parent peut déclarer la perte depuis l'application (EF-15).
  DECLARE_PERDU: {
    depuis: [ACTIF, RESTITUE],
    vers: PERDU,
    roles: [Role.ADMIN, Role.SECRETARIAT, Role.SURVEILLANT, Role.PARENT],
  },
  // Trouvé par n'importe quel membre du personnel, qu'il ait été déclaré perdu ou non.
  TROUVE: { depuis: [ACTIF, PERDU, RESTITUE], vers: TROUVE, roles: PERSONNEL },
  CONFISQUE: {
    depuis: [ACTIF, RESTITUE],
    vers: CONFISQUE,
    roles: [Role.ADMIN, Role.SECRETARIAT, Role.ENSEIGNANT, Role.SURVEILLANT],
  },
  // Rendu à l'élève ou à sa famille.
  RESTITUE: {
    depuis: [PERDU, TROUVE, CONFISQUE],
    vers: RESTITUE,
    roles: [Role.ADMIN, Role.SECRETARIAT, Role.SURVEILLANT],
  },
  // Utilisation non autorisée en classe : le statut ne change pas (EF-14).
  USAGE_EN_CLASSE: {
    depuis: [ACTIF, RESTITUE],
    vers: null,
    roles: [Role.ADMIN, Role.ENSEIGNANT, Role.SURVEILLANT],
  },
};

const LIBELLES_STATUT: Record<StatutAppareil, string> = {
  ACTIF: 'actif',
  PERDU: 'déclaré perdu',
  TROUVE: 'trouvé',
  CONFISQUE: 'confisqué',
  RESTITUE: 'restitué',
};

/** Message d'erreur si le signalement est interdit, sinon null. */
export function erreurIncident(
  type: TypeIncidentAppareil,
  statut: StatutAppareil,
  role: Role,
): string | null {
  const regle = REGLES_INCIDENT[type];
  if (!regle.roles.includes(role)) {
    return 'Votre rôle ne permet pas ce signalement.';
  }
  if (!regle.depuis.includes(statut)) {
    return `Signalement impossible : l'appareil est ${LIBELLES_STATUT[statut]}.`;
  }
  return null;
}

/** Premier jour du mois (UTC) de la date donnée. */
export const debutDuMois = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

/**
 * Vrai quand les signalements d'usage en classe du mois atteignent le seuil et
 * qu'aucun comportement n'a encore été créé ce mois-ci : un seul par mois.
 * Un seuil de 0 désactive la règle.
 */
export const seuilAtteint = (
  signalementsDuMois: number,
  seuil: number,
  comportementDejaCree: boolean,
) => seuil > 0 && signalementsDuMois >= seuil && !comportementDejaCree;

const IMEI = /^\d{15}$/;

/** Contrôle de l'IMEI (15 chiffres, clé de Luhn). */
export function imeiValide(imei: string): boolean {
  if (!IMEI.test(imei)) return false;
  let somme = 0;
  for (let i = 0; i < 15; i++) {
    let chiffre = Number(imei[i]);
    if (i % 2 === 1) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    somme += chiffre;
  }
  return somme % 10 === 0;
}

/** Code court imprimé sous le QR code, pour une saisie manuelle. */
export const codeCourt = (qrCode: string) =>
  qrCode.replace(/-/g, '').slice(-8).toUpperCase();
