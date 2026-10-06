// Rappels de paiement : l'école tient sa comptabilité ailleurs ; ici, seulement le retard
// calculé à partir de la date de paiement normale saisie par le comptable.
import { jourFr } from '../annonces/annonces.regles.js';
import { depuisJour, versJour } from '../common/dates.js';
import { TypeNotification } from '../generated/prisma/enums.js';

const JOUR_MS = 24 * 3600 * 1000;

/** Jours écoulés depuis la date de paiement normale (0 ou négatif : pas encore en retard). */
export function joursDeRetard(
  dateEcheance: Date,
  aujourdHui = new Date(),
): number {
  const jour = depuisJour(versJour(aujourdHui)).getTime();
  return Math.round(
    (jour - depuisJour(versJour(dateEcheance)).getTime()) / JOUR_MS,
  );
}

/** « 1 jour », « 35 jours » */
export const dureeFr = (jours: number) =>
  `${jours} jour${jours > 1 ? 's' : ''}`;

/** « 25 000 » (espaces simples : le SMS ne connaît pas l'espace fine insécable). */
export const montantFr = (montant: number) =>
  montant.toLocaleString('fr-FR').replace(/[  ]/g, ' ');

/** « Mensualité d'octobre » → « mensualité d'octobre », pour l'insérer dans une phrase. */
export const libelleDansPhrase = (libelle: string) =>
  /^[A-ZÀ-Ý][a-zà-ÿ]/.test(libelle)
    ? libelle.charAt(0).toLowerCase() + libelle.slice(1)
    : libelle;

/** Avant la date normale : simple rappel ; à partir du lendemain : retard. */
export const typeRappel = (jours: number) =>
  jours > 0
    ? TypeNotification.RETARD_PAIEMENT
    : TypeNotification.RAPPEL_PAIEMENT;

/** Variables des messages de paiement ; `monnaie` : GNF ou FCFA selon le pays de l'école. */
export function variablesPaiement(
  rappel: { libelle: string; montant: number; dateEcheance: Date },
  autres: { montant: number }[],
  monnaie: string,
  aujourdHui = new Date(),
): Record<string, string> {
  const total = rappel.montant + autres.reduce((s, a) => s + a.montant, 0);
  return {
    libelle: libelleDansPhrase(rappel.libelle),
    montant: montantFr(rappel.montant),
    monnaie,
    date_echeance: jourFr(rappel.dateEcheance),
    jours_retard: dureeFr(
      Math.max(0, joursDeRetard(rappel.dateEcheance, aujourdHui)),
    ),
    total: autres.length
      ? `\n\nAu total, ${montantFr(total)} ${monnaie} restent en attente pour cet élève (${autres.length + 1} paiements).`
      : '',
  };
}

// ─── Relances automatiques (tâche quotidienne) ───────────────────────────────

/** Rappel automatique quelques jours avant la date de paiement normale. */
export const JOURS_RAPPEL_AVANT = 3;
/** Après la date : relance le lendemain, puis tous les 7 jours après le dernier envoi. */
export const INTERVALLE_RELANCES_JOURS = 7;
/** Au-delà, seul le comptable relance (à la main). */
export const RELANCES_AUTO_MAX = 4;

export interface EtatRelance {
  statut: 'EN_COURS' | 'REGLE';
  dateEcheance: Date;
  dernierEnvoiLe: Date | null;
  relancesAuto: number;
}

/**
 * Faut-il prévenir la famille aujourd'hui, sans action du comptable ?
 * - 3 jours avant la date (si rien n'est parti depuis ce moment) ;
 * - à partir du lendemain de la date : si rien n'est parti depuis le début du
 *   retard, puis 7 jours après le dernier envoi (manuel ou automatique),
 *   dans la limite de 4 relances automatiques.
 */
export function doitRelancer(r: EtatRelance, aujourdHui = new Date()): boolean {
  if (r.statut !== 'EN_COURS') return false;
  const jour = joursDeRetard(r.dateEcheance, aujourdHui);
  // Jour du dernier envoi, compté depuis la date de paiement (négatif : avant).
  const dernier =
    r.dernierEnvoiLe && joursDeRetard(r.dateEcheance, r.dernierEnvoiLe);
  const rienDepuis = (debut: number) => dernier === null || dernier < debut;

  if (jour < 0)
    return jour >= -JOURS_RAPPEL_AVANT && rienDepuis(-JOURS_RAPPEL_AVANT);
  if (jour === 0 || r.relancesAuto >= RELANCES_AUTO_MAX) return false;
  return rienDepuis(1) || jour - dernier! >= INTERVALLE_RELANCES_JOURS;
}

/** Jour de la prochaine relance automatique (null : plus aucune de prévue). */
export function prochaineRelanceAuto(
  r: EtatRelance,
  aujourdHui = new Date(),
): Date | null {
  // Au plus un an d'avance (rappel 3 jours avant une date lointaine).
  for (let i = 0; i <= 366; i++) {
    const jour = new Date(
      depuisJour(versJour(aujourdHui)).getTime() + i * JOUR_MS,
    );
    if (doitRelancer(r, jour)) return jour;
  }
  return null;
}
