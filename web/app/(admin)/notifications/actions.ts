'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

type Etat = EtatFormulaire | null;

export async function renvoyerNotification(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/notifications/${id}/renvoyer`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Remise en file.' };
}

export async function enregistrerModele(
  type: string,
  canal: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const sujet = d.get('sujet');
  const erreur = await tenter(() =>
    envoyerApi(`/notifications/modeles/${type}/${canal}`, 'PUT', {
      sujet: typeof sujet === 'string' && sujet.trim() ? sujet : undefined,
      contenu: d.get('contenu'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Modèle enregistré.' };
}

export async function reinitialiserModele(
  type: string,
  canal: string,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/notifications/modeles/${type}/${canal}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Modèle par défaut rétabli.' };
}
