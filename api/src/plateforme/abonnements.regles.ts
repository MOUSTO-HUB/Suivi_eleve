// Abonnements des écoles au service : tarif, essai, période payée, grâce et suspension.
import { depuisJour, versJour } from '../common/dates.js';
import type { FormuleAbonnement } from '../generated/prisma/enums.js';
import { montantFr } from '../paiements/paiements.regles.js';

/** Tarifs en francs guinéens hors taxes (TVA en sus) : l'année = 10 mois payés (2 offerts). */
export const TARIFS_GNF: Record<FormuleAbonnement, number> = {
  MENSUEL: 150_000,
  ANNUEL: 1_500_000,
};
export const MOIS_PAR_FORMULE: Record<FormuleAbonnement, number> = {
  MENSUEL: 1,
  ANNUEL: 12,
};
/** Essai gratuit d'une nouvelle école (jours inclus). */
export const JOURS_ESSAI = 30;
/** Bandeau d'avertissement à la direction avant la fin. */
export const JOURS_AVERTISSEMENT = 7;
/** Après la fin : l'école fonctionne encore, puis elle est suspendue. */
export const JOURS_GRACE = 15;

export type EtatAbonnement =
  'ESSAI' | 'ACTIF' | 'A_RENOUVELER' | 'EN_RETARD' | 'SUSPENDUE';

const JOUR_MS = 24 * 3600 * 1000;

/** Jour calendaire (minuit UTC) : l'heure ne compte pas. */
const jourDe = (date: Date) => depuisJour(versJour(date));

/** Nombre de jours de `de` à `a` (positif si `a` est après). */
export const joursEntre = (de: Date, a: Date) =>
  Math.round((jourDe(a).getTime() - jourDe(de).getTime()) / JOUR_MS);

export const ajouterJours = (date: Date, jours: number) =>
  new Date(jourDe(date).getTime() + jours * JOUR_MS);

/** Ajoute des mois ; le 31 janvier + 1 mois donne le 28 (ou 29) février. */
export function ajouterMois(date: Date, mois: number): Date {
  const d = jourDe(date);
  const cible = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1),
  );
  const dernierJour = new Date(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cible.setUTCDate(Math.min(d.getUTCDate(), dernierJour));
  return cible;
}

/** Dernier jour de l'essai d'une école créée ce jour-là. */
export const finEssai = (creeLe: Date) => ajouterJours(creeLe, JOURS_ESSAI - 1);

export interface SituationAbonnement {
  etat: EtatAbonnement;
  /** Encore en essai gratuit (aucun paiement enregistré). */
  essai: boolean;
  /** Jours avant la fin (0 : dernier jour ; négatif : en retard). */
  joursRestants: number;
  /** Dernier jour avant la suspension automatique. */
  finGrace: Date;
}

/**
 * État de l'abonnement d'une école au jour donné. Une suspension à la main
 * l'emporte ; sinon : à renouveler les 7 derniers jours, en retard pendant les
 * 15 jours de grâce, suspendue ensuite.
 */
export function situationAbonnement(
  ecole: { finAbonnement: Date; suspendueLe: Date | null; aPaye: boolean },
  aujourdHui = new Date(),
): SituationAbonnement {
  const joursRestants = joursEntre(aujourdHui, ecole.finAbonnement);
  const finGrace = ajouterJours(ecole.finAbonnement, JOURS_GRACE);
  const essai = !ecole.aPaye;
  const etat: EtatAbonnement =
    ecole.suspendueLe || joursRestants < -JOURS_GRACE
      ? 'SUSPENDUE'
      : joursRestants < 0
        ? 'EN_RETARD'
        : joursRestants < JOURS_AVERTISSEMENT
          ? 'A_RENOUVELER'
          : essai
            ? 'ESSAI'
            : 'ACTIF';
  return { etat, essai, joursRestants, finGrace };
}

/**
 * Période couverte par un paiement : elle suit la période précédente (y
 * compris les jours de grâce déjà utilisés) ; si l'école était déjà suspendue
 * au jour du paiement, elle repart de ce jour.
 */
export function periodePayee(
  formule: FormuleAbonnement,
  finActuelle: Date,
  payeLe: Date,
): { debut: Date; fin: Date } {
  const debut =
    joursEntre(finActuelle, payeLe) > JOURS_GRACE
      ? jourDe(payeLe)
      : ajouterJours(finActuelle, 1);
  const fin = ajouterJours(ajouterMois(debut, MOIS_PAR_FORMULE[formule]), -1);
  return { debut, fin };
}

/** « 1 500 000 GNF » (espaces simples, lisibles dans un SMS). */
export const montantGnf = (montant: number) => `${montantFr(montant)} GNF`;
