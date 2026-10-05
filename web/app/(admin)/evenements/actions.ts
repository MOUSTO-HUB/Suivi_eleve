'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { Evenement } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const TAILLE_MAX = 5 * 1024 * 1024;

/**
 * Crée l'événement, joint le document éventuel puis prévient les familles
 * (tout de suite ou à la date choisie). En cas d'échec, le brouillon est retiré.
 */
export async function creerEvenement(_e: Etat, d: FormData): Promise<Etat> {
  const cible = texte(d, 'cible');
  const programme = d.get('envoi') === 'programme';
  const quand = texte(d, 'programmeeLe');
  if (programme && !quand)
    return { erreur: "Choisissez la date et l'heure d'envoi." };
  const fichier = d.get('fichier');
  const piece = fichier instanceof File && fichier.size > 0 ? fichier : null;
  if (piece && piece.size > TAILLE_MAX)
    return { erreur: 'La pièce jointe dépasse 5 Mo.' };

  let id = '';
  const erreur = await tenter(async () => {
    const evenement = await envoyerApi<Evenement>('/evenements', 'POST', {
      titre: texte(d, 'titre'),
      description: texte(d, 'description'),
      date: texte(d, 'date'),
      heure: texte(d, 'heure'),
      dateFin: texte(d, 'dateFin'),
      lieu: texte(d, 'lieu'),
      modalites: texte(d, 'modalites'),
      cible,
      classeIds: cible === 'CLASSES' ? d.getAll('classeIds') : undefined,
      question: d.get('reponse') === 'oui' ? texte(d, 'question') : undefined,
    });
    id = evenement.id;
    try {
      if (piece) {
        const envoi = new FormData();
        envoi.set('fichier', piece, piece.name);
        await envoyerApi(`/evenements/${id}/piece-jointe`, 'POST', envoi);
      }
      await envoyerApi(`/evenements/${id}/publier`, 'POST', {
        // Saisie à l'heure de Dakar (UTC+0).
        programmeeLe: programme ? `${quand}:00Z` : undefined,
      });
    } catch (e) {
      await envoyerApi(`/evenements/${id}`, 'DELETE').catch(() => undefined);
      throw e;
    }
  });
  if (erreur) return erreur;
  redirect(`/evenements/${id}`);
}

export async function publierEvenement(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/evenements/${id}/publier`, 'POST', {}),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Familles prévenues.' };
}

export async function annulerEvenement(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/evenements/${id}/annuler`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Événement annulé.' };
}

export async function supprimerEvenement(id: string): Promise<Etat> {
  const erreur = await tenter(() => envoyerApi(`/evenements/${id}`, 'DELETE'));
  if (erreur) return erreur;
  redirect('/evenements');
}
