'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { PreferenceNotification } from '@/lib/types';

type Etat = EtatFormulaire | null;

export async function consentir(version: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi('/auth/consentement', 'POST', { version }),
  );
  if (erreur) return erreur;
  redirect('/parent');
}

export async function repondre(
  evenementId: string,
  eleveId: string,
  reponse: boolean,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/evenements/${evenementId}/reponses`, 'POST', {
      eleveId,
      reponse,
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: `Réponse enregistrée : ${reponse ? 'oui' : 'non'}.` };
}

export async function donnerMotif(
  absenceId: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const motif = String(d.get('motif') ?? '').trim();
  if (!motif) return { erreur: "Indiquez le motif de l'absence." };
  const erreur = await tenter(() =>
    envoyerApi(`/absences/${absenceId}/justification-parent`, 'POST', {
      motif,
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: "Motif transmis à l'école." };
}

export async function declarerPerte(
  appareilId: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const commentaire = String(d.get('commentaire') ?? '').trim();
  const erreur = await tenter(() =>
    envoyerApi(`/appareils/${appareilId}/signalements`, 'POST', {
      type: 'DECLARE_PERDU',
      commentaire: commentaire || undefined,
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: "Perte déclarée : l'école est prévenue." };
}

export async function enregistrerPreferences(
  types: PreferenceNotification['type'][],
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi('/notifications/preferences', 'PUT', {
      preferences: types.map((type) => ({
        type,
        sms: d.get(`${type}:sms`) === 'on',
        email: d.get(`${type}:email`) === 'on',
        push: d.get(`${type}:push`) === 'on',
      })),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Préférences enregistrées.' };
}

/** Abonnement Web Push du navigateur (site installé) pour recevoir les messages. */
export async function abonnerNotifications(abonnement: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<Etat> {
  return tenter(() =>
    envoyerApi('/notifications/jetons-push', 'POST', {
      jeton: abonnement.endpoint,
      plateforme: 'WEB',
      cleP256dh: abonnement.p256dh,
      cleAuth: abonnement.auth,
    }),
  );
}

export async function desabonnerNotifications(endpoint: string): Promise<Etat> {
  return tenter(() =>
    envoyerApi('/notifications/jetons-push', 'DELETE', { jeton: endpoint }),
  );
}
