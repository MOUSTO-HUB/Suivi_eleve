// Règles de sécurité de la connexion du personnel, sans accès à la base (testées).
import { MethodeDoubleAuth, Role } from '../generated/prisma/enums.js';

/** Essais incorrects (mot de passe ou code) avant un blocage. */
export const ESSAIS_AVANT_BLOCAGE = 3;

/** 1er blocage : 30 minutes ; 2e : 3 heures ; le 3e désactive le compte. */
export const DUREES_BLOCAGE_MS = [30 * 60 * 1000, 3 * 60 * 60 * 1000];

export type Sanction =
  { type: 'blocage'; dureeMs: number } | { type: 'desactivation' };

/** Sanction appliquée au blocage numéro `numero` (1, 2, 3…) depuis la dernière connexion réussie. */
export function sanction(numero: number): Sanction {
  const duree = DUREES_BLOCAGE_MS[numero - 1];
  return duree === undefined
    ? { type: 'desactivation' }
    : { type: 'blocage', dureeMs: duree };
}

/** « 30 minutes », « 3 heures », « 1 heure et 5 minutes ». */
export function dureeLisible(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  const h = heures ? `${heures} heure${heures > 1 ? 's' : ''}` : '';
  const m = reste ? `${reste} minute${reste > 1 ? 's' : ''}` : '';
  return h && m ? `${h} et ${m}` : h || m;
}

/** Qui réactive un compte désactivé après trop d'essais. */
export function quiReactive(role: Role): string {
  if (role === Role.SUPER_ADMIN)
    return 'Relancez la commande « initialiser » sur le serveur (voir le guide de déploiement).';
  if (role === Role.ADMIN)
    return 'Demandez au concepteur de Suivi_eleve de le réactiver.';
  return "Demandez à la direction de l'école de le réactiver.";
}

/** Rôles pour lesquels la double authentification ne peut pas être retirée. */
export const ROLES_DOUBLE_AUTH_OBLIGATOIRE: readonly Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.SUPER_ADMIN,
];

export const doubleAuthObligatoire = (role: Role) =>
  ROLES_DOUBLE_AUTH_OBLIGATOIRE.includes(role);

/** Méthode appliquée à la connexion : celle choisie, sinon l'email pour les rôles obligés. */
export function methodeDoubleAuth(u: {
  role: Role;
  doubleAuth: MethodeDoubleAuth | null;
}): MethodeDoubleAuth | null {
  if (u.doubleAuth) return u.doubleAuth;
  return doubleAuthObligatoire(u.role) ? MethodeDoubleAuth.EMAIL : null;
}

/** « d•••••@ecole.sn » : rappelle où le code est parti sans dévoiler l'adresse. */
export function emailMasque(email: string): string {
  const [nom, domaine] = email.split('@');
  if (!domaine) return '•••';
  return `${nom.slice(0, 1)}${'•'.repeat(Math.max(3, nom.length - 1))}@${domaine}`;
}

/** Remise à zéro des blocages : connexion réussie ou réactivation par la direction. */
export const DEBLOCAGE = {
  echecsConnexion: 0,
  blocages: 0,
  bloqueJusquA: null,
  verrouilleLe: null,
};

/** Double authentification retirée (téléphone perdu : réinitialisation par la direction). */
export const SANS_DOUBLE_AUTH = {
  doubleAuth: null,
  totpSecret: null,
  totpDernierPas: null,
  codesSecours: [],
};
