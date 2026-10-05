'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function modifierTuteur(
  id: string,
  _e: EtatFormulaire | null,
  d: FormData,
): Promise<EtatFormulaire | null> {
  const erreur = await tenter(() =>
    envoyerApi(`/tuteurs/${id}`, 'PATCH', {
      prenoms: texte(d, 'prenoms'),
      nom: texte(d, 'nom'),
      contact1: texte(d, 'contact1'),
      // Champs facultatifs : une valeur vide efface l'ancienne.
      contact2: texte(d, 'contact2') ?? null,
      email: texte(d, 'email') ?? null,
      langue: texte(d, 'langue'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Tuteur enregistré.' };
}
