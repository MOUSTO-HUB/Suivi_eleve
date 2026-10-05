'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { Annonce } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function creerAnnonce(_e: Etat, d: FormData): Promise<Etat> {
  const type = texte(d, 'type');
  const cible = texte(d, 'cible');
  const programmee = d.get('envoi') === 'programme';
  const quand = texte(d, 'programmeeLe');
  if (programmee && !quand)
    return { erreur: "Choisissez la date et l'heure d'envoi." };

  let id = '';
  const erreur = await tenter(async () => {
    const annonce = await envoyerApi<Annonce>('/annonces', 'POST', {
      type,
      cible,
      classeIds: cible === 'CLASSES' ? d.getAll('classeIds') : undefined,
      date: texte(d, 'date'),
      heure: type === 'LIBERATION_ANTICIPEE' ? texte(d, 'heure') : undefined,
      creneau: type === 'PAS_DE_COURS' ? texte(d, 'creneau') : undefined,
      motif: texte(d, 'motif'),
      motifDetail: texte(d, 'motifDetail'),
      message: texte(d, 'message'),
      // Saisie à l'heure de Dakar (UTC+0).
      programmeeLe: programmee ? `${quand}:00Z` : undefined,
    });
    id = annonce.id;
  });
  if (erreur) return erreur;
  redirect(`/annonces/${id}`);
}

export async function annulerAnnonce(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/annonces/${id}/annuler`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Envoi annulé.' };
}

export async function envoyerAnnonce(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/annonces/${id}/envoyer`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Envoi lancé.' };
}
