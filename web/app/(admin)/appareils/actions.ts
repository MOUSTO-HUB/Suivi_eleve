'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { AppareilDetail } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const description = (d: FormData) => ({
  type: texte(d, 'type'),
  marque: texte(d, 'marque'),
  modele: texte(d, 'modele'),
  couleur: texte(d, 'couleur'),
  numeroSerie: texte(d, 'numeroSerie'),
  imei: texte(d, 'imei'),
  signesDistinctifs: texte(d, 'signesDistinctifs'),
});

export async function creerAppareil(_e: Etat, d: FormData): Promise<Etat> {
  let id = '';
  const erreur = await tenter(async () => {
    const appareil = await envoyerApi<AppareilDetail>('/appareils', 'POST', {
      eleveId: texte(d, 'eleveId'),
      ...description(d),
    });
    id = appareil.id;
  });
  if (erreur) return erreur;
  redirect(`/appareils/${id}`);
}

export async function modifierAppareil(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/appareils/${id}`, 'PATCH', description(d)),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Appareil enregistré.' };
}

export async function signalerAppareil(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  let comportementCree = false;
  const erreur = await tenter(async () => {
    const resultat = await envoyerApi<{ comportementCree: boolean }>(
      `/appareils/${id}/signalements`,
      'POST',
      {
        type: texte(d, 'type'),
        lieu: texte(d, 'lieu'),
        commentaire: texte(d, 'commentaire'),
      },
    );
    comportementCree = resultat.comportementCree;
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: comportementCree
      ? 'Signalement enregistré. Seuil mensuel atteint : un comportement a été inscrit au dossier de l’élève et la famille est prévenue.'
      : 'Signalement enregistré. La famille est prévenue.',
  };
}

export async function envoyerPhoto(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const photo = d.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    return {
      erreur: 'Choisissez une photo (JPEG, PNG ou WebP, 3 Mo au maximum).',
    };
  }
  const envoi = new FormData();
  envoi.set('photo', photo, photo.name);
  const erreur = await tenter(() =>
    envoyerApi(`/appareils/${id}/photo`, 'POST', envoi),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Photo enregistrée.' };
}
