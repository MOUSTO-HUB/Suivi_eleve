'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

type Etat = EtatFormulaire | null;

const classe = (d: FormData) => ({
  nom: String(d.get('nom') ?? '').trim(),
  niveau: String(d.get('niveau') ?? '').trim(),
});

export async function creerClasse(_e: Etat, d: FormData): Promise<Etat> {
  const erreur = await tenter(() => envoyerApi('/classes', 'POST', classe(d)));
  if (erreur) return erreur;
  refresh();
  return { succes: `Classe « ${classe(d).nom} » créée.` };
}

export async function modifierClasse(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/classes/${id}`, 'PATCH', classe(d)),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Classe enregistrée.' };
}
