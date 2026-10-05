'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import { lireNote } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

/** Identifiants des élèves présents dans le formulaire (un champ caché par ligne). */
const eleves = (d: FormData) =>
  d.getAll('eleveId').filter((v): v is string => typeof v === 'string');

export async function enregistrerMoyennes(
  cible: { classeId: string; periodeId: string; matiereId: string },
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const lignes = eleves(d).map((eleveId) => ({
    eleveId,
    moyenne: lireNote(d.get(`moyenne-${eleveId}`)),
    appreciation: texte(d, `appreciation-${eleveId}`),
  }));
  if (lignes.some((l) => Number.isNaN(l.moyenne))) {
    return { erreur: 'Une moyenne n’est pas un nombre (ex. 14,5).' };
  }
  const erreur = await tenter(() =>
    envoyerApi('/resultats/moyennes', 'PUT', { ...cible, lignes }),
  );
  if (erreur) return erreur;
  refresh();
  return {
    succes: `${lignes.filter((l) => l.moyenne !== null).length} moyenne(s) enregistrée(s).`,
  };
}

export async function enregistrerGeneraux(
  cible: { classeId: string; periodeId: string },
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const lignes = eleves(d).map((eleveId) => {
    const rang = texte(d, `rang-${eleveId}`);
    return {
      eleveId,
      moyenne: lireNote(d.get(`moyenne-${eleveId}`)),
      rang: rang ? Number(rang) : null,
      appreciation: texte(d, `appreciation-${eleveId}`),
    };
  });
  if (lignes.some((l) => Number.isNaN(l.moyenne) || Number.isNaN(l.rang))) {
    return { erreur: 'Une moyenne ou un rang n’est pas un nombre.' };
  }
  const erreur = await tenter(() =>
    envoyerApi('/resultats/generaux', 'PUT', { ...cible, lignes }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Résultats généraux enregistrés.' };
}

export async function publierResultats(cible: {
  classeId: string;
  periodeId: string;
}): Promise<Etat> {
  let bilan = { eleves: 0, famillesPrevenues: 0 };
  const erreur = await tenter(async () => {
    bilan = await envoyerApi<typeof bilan>('/resultats/publier', 'POST', cible);
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: `Résultats publiés pour ${bilan.eleves} élève(s) ; ${bilan.famillesPrevenues} famille(s) prévenue(s).`,
  };
}

export async function enregistrerDecisions(
  classeId: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const lignes = eleves(d)
    .map((eleveId) => ({
      eleveId,
      decision: texte(d, `decision-${eleveId}`),
      moyenneAnnuelle: lireNote(d.get(`moyenne-${eleveId}`)),
      observation: texte(d, `observation-${eleveId}`),
    }))
    .filter((l) => l.decision);
  if (!lignes.length) return { erreur: 'Choisissez au moins une décision.' };
  if (lignes.some((l) => Number.isNaN(l.moyenneAnnuelle))) {
    return { erreur: 'Une moyenne annuelle n’est pas un nombre.' };
  }
  const erreur = await tenter(() =>
    envoyerApi('/resultats/decisions', 'PUT', { classeId, lignes }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: `${lignes.length} décision(s) enregistrée(s).` };
}

export async function publierDecisions(classeId: string): Promise<Etat> {
  let bilan = { eleves: 0, famillesPrevenues: 0 };
  const erreur = await tenter(async () => {
    bilan = await envoyerApi<typeof bilan>(
      '/resultats/decisions/publier',
      'POST',
      { classeId },
    );
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: `Décisions publiées ; ${bilan.famillesPrevenues} famille(s) prévenue(s).`,
  };
}
