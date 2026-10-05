'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function faireAppel(_e: Etat, d: FormData): Promise<Etat> {
  const eleveIds = d
    .getAll('eleveIds')
    .filter((v): v is string => typeof v === 'string');
  if (!eleveIds.length) return { erreur: 'Cochez au moins un élève absent.' };
  const justifiee = d.get('justifiee') === 'on';

  let bilan = { creees: 0, dejaNotees: 0, famillesPrevenues: 0 };
  const erreur = await tenter(async () => {
    bilan = await envoyerApi<typeof bilan>('/absences', 'POST', {
      eleveIds,
      date: texte(d, 'date'),
      creneau: texte(d, 'creneau'),
      matiere: texte(d, 'matiere'),
      justifiee,
      motif: justifiee ? texte(d, 'motif') : undefined,
    });
  });
  if (erreur) return erreur;
  refresh();
  const morceaux = [`${bilan.creees} absence(s) notée(s)`];
  if (bilan.famillesPrevenues)
    morceaux.push(`${bilan.famillesPrevenues} famille(s) prévenue(s)`);
  if (bilan.dejaNotees)
    morceaux.push(`${bilan.dejaNotees} déjà notée(s) pour ce créneau`);
  return { succes: `${morceaux.join(', ')}.` };
}

export async function justifierAbsence(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/absences/${id}/justifier`, 'POST', {
      motif: texte(d, 'motif'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Absence justifiée.' };
}

export async function supprimerAbsence(id: string): Promise<Etat> {
  const erreur = await tenter(() => envoyerApi(`/absences/${id}`, 'DELETE'));
  if (erreur) return erreur;
  refresh();
  return { succes: 'Absence supprimée.' };
}
