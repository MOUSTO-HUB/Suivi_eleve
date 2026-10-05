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

/** Variables des messages de paiement. */
export function variablesPaiement(
  rappel: { libelle: string; montant: number; dateEcheance: Date },
  autres: { montant: number }[],
  aujourdHui = new Date(),
): Record<string, string> {
  const total = rappel.montant + autres.reduce((s, a) => s + a.montant, 0);
  return {
    libelle: libelleDansPhrase(rappel.libelle),
    montant: montantFr(rappel.montant),
    date_echeance: jourFr(rappel.dateEcheance),
    jours_retard: dureeFr(
      Math.max(0, joursDeRetard(rappel.dateEcheance, aujourdHui)),
    ),
    total: autres.length
      ? `\n\nAu total, ${montantFr(total)} FCFA restent en attente pour cet élève (${autres.length + 1} paiements).`
      : '',
  };
}
