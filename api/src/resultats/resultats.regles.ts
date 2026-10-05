// Résultats saisis par les professeurs : aucune moyenne n'est calculée par l'application.
import { DecisionFinAnnee } from '../generated/prisma/enums.js';

/** « 14.5 » → « 14,50 » (affichage à la française, 2 décimales). */
export const noteFr = (n: number | null | undefined): string =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** 1 → « 1er », 5 → « 5e ». */
export const rangFr = (rang: number): string =>
  rang === 1 ? '1er' : `${rang}e`;

/** « 5e sur 35 » ; sans rang saisi : « non communiqué ». */
export const rangSur = (
  rang: number | null | undefined,
  effectif: number,
): string => (rang ? `${rangFr(rang)} sur ${effectif}` : 'non communiqué');

export const LIBELLES_DECISION: Record<DecisionFinAnnee, string> = {
  ADMIS: 'admis(e) en classe supérieure',
  REDOUBLE: 'redouble la classe',
  EXCLU: 'exclu(e)',
  ORIENTE: 'orienté(e)',
};

/** Message d'erreur si la moyenne saisie n'est pas valable, sinon null. */
export function erreurMoyenne(
  moyenne: number | null | undefined,
): string | null {
  if (moyenne === null || moyenne === undefined) return null;
  if (!Number.isFinite(moyenne) || moyenne < 0 || moyenne > 20) {
    return `Moyenne invalide (${moyenne}) : elle doit être comprise entre 0 et 20.`;
  }
  // Tolérance : 12.34 * 100 vaut 1233.9999… en virgule flottante.
  if (Math.abs(Math.round(moyenne * 100) - moyenne * 100) > 1e-6) {
    return `Moyenne invalide (${moyenne}) : 2 décimales au plus.`;
  }
  return null;
}

/** Message d'erreur si le rang n'est pas possible pour cet effectif, sinon null. */
export function erreurRang(
  rang: number | null | undefined,
  effectif: number,
): string | null {
  if (rang === null || rang === undefined) return null;
  if (!Number.isInteger(rang) || rang < 1 || rang > effectif) {
    return `Rang invalide (${rang}) : il doit être compris entre 1 et ${effectif}.`;
  }
  return null;
}
