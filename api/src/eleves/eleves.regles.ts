import { BadRequestException } from '@nestjs/common';
import { calculerAge, depuisJour, versJour } from '../common/dates.js';
import { Prisma } from '../generated/prisma/client.js';
import type { LienTuteur } from '../generated/prisma/enums.js';

export const AGE_MIN = 2;
export const AGE_MAX = 30;

/** Matricule SE-AAAA-NNNN (cahier des charges, EF-01). */
export const formaterMatricule = (annee: number, numero: number): string =>
  `SE-${annee}-${String(numero).padStart(4, '0')}`;

/** Prochain matricule libre pour l'année d'inscription donnée. */
export async function prochainMatricule(
  tx: Prisma.TransactionClient,
  annee: number,
): Promise<string> {
  const prefixe = `SE-${annee}-`;
  const [{ max }] = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(split_part(matricule, '-', 3) AS INTEGER)) AS max
    FROM eleves
    WHERE matricule LIKE ${`${prefixe}%`}
      AND split_part(matricule, '-', 3) ~ '^[0-9]+$'`;
  return formaterMatricule(annee, (max ?? 0) + 1);
}

/** Message d'erreur si la date de naissance est invalide, sinon null. */
export function erreurDateNaissance(
  jour: string,
  aujourdHui = new Date(),
): string | null {
  const date = depuisJour(jour);
  // Un 30 février deviendrait silencieusement le 2 mars : on compare la date relue.
  if (Number.isNaN(date.getTime()) || versJour(date) !== jour) {
    return `Date de naissance invalide : ${jour}.`;
  }
  const age = calculerAge(date, aujourdHui);
  if (age < AGE_MIN || age > AGE_MAX) {
    return `Date de naissance improbable (${age} ans) : l'âge doit être entre ${AGE_MIN} et ${AGE_MAX} ans.`;
  }
  return null;
}

export function verifierDateNaissance(jour: string): void {
  const erreur = erreurDateNaissance(jour);
  if (erreur) throw new BadRequestException(erreur);
}

export interface TuteurDemande {
  tuteurId?: string;
  prenoms?: string;
  nom?: string;
  contact1?: string;
  contact2?: string;
  email?: string;
  lien: LienTuteur;
  principal?: boolean;
}

/**
 * Vérifie la liste des tuteurs d'un élève : pas de doublon, un seul principal.
 * Sans principal désigné, le premier le devient.
 */
export function normaliserTuteurs<T extends TuteurDemande>(
  tuteurs: T[],
): (T & { principal: boolean })[] {
  const cles = tuteurs.map((t) => t.tuteurId ?? t.contact1);
  if (new Set(cles).size !== cles.length) {
    throw new BadRequestException('Le même tuteur est indiqué deux fois.');
  }
  const principaux = tuteurs.filter((t) => t.principal).length;
  if (principaux > 1) {
    throw new BadRequestException('Un seul tuteur peut être principal.');
  }
  return tuteurs.map((t, i) => ({
    ...t,
    principal: principaux === 0 ? i === 0 : Boolean(t.principal),
  }));
}
