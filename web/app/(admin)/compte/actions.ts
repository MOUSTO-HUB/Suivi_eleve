'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

export async function changerMotDePasse(
  _e: EtatFormulaire | null,
  d: FormData,
): Promise<EtatFormulaire | null> {
  const nouveau = String(d.get('nouveau') ?? '');
  if (nouveau !== d.get('confirmation'))
    return {
      erreur: 'Les deux nouveaux mots de passe ne sont pas identiques.',
    };
  const erreur = await tenter(() =>
    envoyerApi('/utilisateurs/moi/mot-de-passe', 'POST', {
      actuel: d.get('actuel'),
      nouveau,
    }),
  );
  return erreur ?? { succes: 'Mot de passe changé.' };
}

/** Résultat d'une action qui donne des codes de secours (affichés une seule fois). */
export interface EtatCodes extends EtatFormulaire {
  codes?: string[];
}

/** Active l'application d'authentification après un premier code juste. */
export async function activerApplication(
  _e: EtatCodes | null,
  d: FormData,
): Promise<EtatCodes | null> {
  let codes: string[] = [];
  const erreur = await tenter(async () => {
    const r = await envoyerApi<{ codesSecours: string[] }>(
      '/auth/double-auth/application',
      'POST',
      {
        jeton: d.get('jeton'),
        code: String(d.get('code') ?? '').replace(/\s/g, ''),
        motDePasse: d.get('motDePasse'),
      },
    );
    codes = r.codesSecours;
  });
  return erreur ?? { succes: 'Application d’authentification activée.', codes };
}

export async function nouveauxCodesSecours(
  _e: EtatCodes | null,
  d: FormData,
): Promise<EtatCodes | null> {
  let codes: string[] = [];
  const erreur = await tenter(async () => {
    const r = await envoyerApi<{ codesSecours: string[] }>(
      '/auth/double-auth/codes-secours',
      'POST',
      { motDePasse: d.get('motDePasse') },
    );
    codes = r.codesSecours;
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: 'Nouveaux codes de secours : les anciens ne servent plus.',
    codes,
  };
}

export async function choisirEmail(
  _e: EtatFormulaire | null,
  d: FormData,
): Promise<EtatFormulaire | null> {
  const erreur = await tenter(() =>
    envoyerApi('/auth/double-auth/email', 'POST', {
      motDePasse: d.get('motDePasse'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Un code vous sera envoyé par email à chaque connexion.' };
}

export async function desactiverDoubleAuth(
  _e: EtatFormulaire | null,
  d: FormData,
): Promise<EtatFormulaire | null> {
  const erreur = await tenter(() =>
    envoyerApi('/auth/double-auth/desactivation', 'POST', {
      motDePasse: d.get('motDePasse'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Double authentification désactivée.' };
}
