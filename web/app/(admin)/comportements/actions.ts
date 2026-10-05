'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { Comportement } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function signalerComportement(
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const type = texte(d, 'type');
  const convocation = texte(d, 'convocationLe');
  let statut = '';
  const erreur = await tenter(async () => {
    const c = await envoyerApi<Comportement>('/comportements', 'POST', {
      eleveId: texte(d, 'eleveId'),
      type,
      categorie: texte(d, 'categorie'),
      gravite:
        type === 'NEGATIF' ? Number(texte(d, 'gravite') ?? 1) : undefined,
      description: texte(d, 'description'),
      sanction: type === 'NEGATIF' ? texte(d, 'sanction') : undefined,
      // Saisie à l'heure de Dakar (UTC+0).
      convocationLe:
        type === 'NEGATIF' && convocation ? `${convocation}:00Z` : undefined,
    });
    statut = c.statut;
  });
  if (erreur) return erreur;
  redirect(`/comportements?signale=${statut}`);
}

export async function validerComportement(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/comportements/${id}/valider`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Validé : la famille est prévenue.' };
}

export async function rejeterComportement(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/comportements/${id}/rejeter`, 'POST', {
      motif: texte(d, 'motif'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Refusé : aucun message envoyé.' };
}

export async function supprimerComportement(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/comportements/${id}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Supprimé.' };
}
