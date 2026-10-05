'use server';

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
