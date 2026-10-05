'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import { lireNote } from '@/lib/types';

type Etat = EtatFormulaire | null;

export async function creerMatiere(_e: Etat, d: FormData): Promise<Etat> {
  const coefficient = lireNote(d.get('coefficient'));
  const erreur = await tenter(() =>
    envoyerApi('/matieres', 'POST', {
      nom: d.get('nom'),
      coefficient: coefficient ?? undefined,
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Matière ajoutée.' };
}

export async function modifierCoefficient(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const coefficient = lireNote(d.get('coefficient'));
  if (coefficient === null || Number.isNaN(coefficient)) {
    return { erreur: 'Coefficient invalide.' };
  }
  const erreur = await tenter(() =>
    envoyerApi(`/matieres/${id}`, 'PATCH', { coefficient }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Enregistré.' };
}

/** Matières cochées pour la classe, avec le professeur choisi pour chacune. */
export async function definirEnseignements(
  classeId: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const enseignements = d
    .getAll('matiereId')
    .filter((v): v is string => typeof v === 'string')
    .map((matiereId) => {
      const prof = d.get(`prof-${matiereId}`);
      return {
        matiereId,
        enseignantId: typeof prof === 'string' && prof ? prof : null,
      };
    });
  const erreur = await tenter(() =>
    envoyerApi(`/classes/${classeId}/enseignements`, 'PUT', { enseignements }),
  );
  if (erreur) return erreur;
  refresh();
  return {
    succes: `${enseignements.length} matière(s) enregistrée(s) pour la classe.`,
  };
}
