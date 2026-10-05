'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function creerCompte(_e: Etat, d: FormData): Promise<Etat> {
  let motDePasse = '';
  const erreur = await tenter(async () => {
    const compte = await envoyerApi<{ motDePasseProvisoire: string }>(
      '/utilisateurs',
      'POST',
      {
        prenoms: texte(d, 'prenoms'),
        nom: texte(d, 'nom'),
        email: texte(d, 'email'),
        role: texte(d, 'role'),
      },
    );
    motDePasse = compte.motDePasseProvisoire;
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: `Compte créé. Mot de passe provisoire à transmettre à la personne (affiché une seule fois) : ${motDePasse}`,
  };
}

export async function modifierCompte(
  id: string,
  champs: { role?: string; actif?: boolean },
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/utilisateurs/${id}`, 'PATCH', champs),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Compte modifié.' };
}

export async function changerRole(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  return modifierCompte(id, { role: texte(d, 'role') });
}

export async function reinitialiser(id: string): Promise<Etat> {
  let motDePasse = '';
  const erreur = await tenter(async () => {
    const r = await envoyerApi<{ motDePasseProvisoire: string }>(
      `/utilisateurs/${id}/reinitialiser-mot-de-passe`,
      'POST',
    );
    motDePasse = r.motDePasseProvisoire;
  });
  if (erreur) return erreur;
  return {
    succes: `Nouveau mot de passe provisoire (affiché une seule fois) : ${motDePasse}`,
  };
}
