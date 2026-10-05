import 'server-only';
import { cache } from 'react';
import { lireApi } from './api';
import { peutGerer, type Profil } from './types';

/** Profil de l'utilisateur connecté, lu une seule fois par requête. */
export const profilCourant = cache(() => lireApi<Profil>('/auth/moi'));

export async function peutGererDossiers(): Promise<boolean> {
  return peutGerer((await profilCourant()).role);
}
