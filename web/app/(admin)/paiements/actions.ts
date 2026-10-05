'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { RappelPaiement } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const resultat = (
  r: RappelPaiement & { famillesPrevenues: number },
  verbe: string,
) =>
  `${verbe} : ${r.famillesPrevenues} famille(s) prévenue(s)${
    r.joursRetard > 0
      ? `, ${r.joursRetard} jour(s) de retard`
      : ', avant la date normale'
  }.`;

export async function creerRappel(_e: Etat, d: FormData): Promise<Etat> {
  // Montant saisi librement : « 25 000 », « 25000 ».
  const montant = Number((texte(d, 'montant') ?? '').replace(/[\s.]/g, ''));
  let message = '';
  const erreur = await tenter(async () => {
    const r = await envoyerApi<RappelPaiement & { famillesPrevenues: number }>(
      '/rappels-paiement',
      'POST',
      {
        eleveId: texte(d, 'eleveId'),
        libelle: texte(d, 'libelle'),
        montant,
        dateEcheance: texte(d, 'dateEcheance'),
      },
    );
    message = resultat(r, 'Rappel envoyé');
  });
  if (erreur) return erreur;
  refresh();
  return { succes: message };
}

export async function relancer(id: string): Promise<Etat> {
  let message = '';
  const erreur = await tenter(async () => {
    const r = await envoyerApi<RappelPaiement & { famillesPrevenues: number }>(
      `/rappels-paiement/${id}/relancer`,
      'POST',
    );
    message = resultat(r, 'Relance envoyée');
  });
  if (erreur) return erreur;
  refresh();
  return { succes: message };
}

export async function regler(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/rappels-paiement/${id}/regler`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Marqué réglé.' };
}

export async function supprimer(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/rappels-paiement/${id}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Supprimé.' };
}
