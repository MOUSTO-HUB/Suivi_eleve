'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { DetailEcolePlateforme } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const infosEcole = (d: FormData) => ({
  nom: texte(d, 'nom'),
  pays: texte(d, 'pays'),
  adresse: texte(d, 'adresse'),
  telephone: texte(d, 'telephone'),
  email: texte(d, 'email'),
});

/** Nouvelle école : le mot de passe provisoire de la direction n'est affiché qu'ici. */
export async function creerEcole(_e: Etat, d: FormData): Promise<Etat> {
  const sortie: {
    ecole?: {
      nom: string;
      compteDirection: { email: string; motDePasseProvisoire: string };
    };
  } = {};
  const erreur = await tenter(async () => {
    sortie.ecole = await envoyerApi('/plateforme/ecoles', 'POST', {
      ...infosEcole(d),
      directionPrenoms: texte(d, 'directionPrenoms'),
      directionNom: texte(d, 'directionNom'),
      directionEmail: texte(d, 'directionEmail'),
    });
  });
  if (erreur || !sortie.ecole) return erreur;
  const { nom, compteDirection } = sortie.ecole;
  return {
    succes: `École « ${nom} » créée, avec 1 mois d'essai gratuit. Compte de la direction : ${compteDirection.email} — mot de passe provisoire à lui transmettre (affiché une seule fois) : ${compteDirection.motDePasseProvisoire}`,
  };
}

export async function modifierEcole(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/plateforme/ecoles/${id}`, 'PATCH', infosEcole(d)),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Informations enregistrées.' };
}

export async function enregistrerPaiement(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const montant = texte(d, 'montant');
  let fin = '';
  const erreur = await tenter(async () => {
    const ecole = await envoyerApi<DetailEcolePlateforme>(
      `/plateforme/ecoles/${id}/paiements`,
      'POST',
      {
        formule: texte(d, 'formule'),
        moyen: texte(d, 'moyen'),
        reference: texte(d, 'reference'),
        payeLe: texte(d, 'payeLe'),
        montant: montant ? Number(montant.replace(/\s/g, '')) : undefined,
      },
    );
    fin = ecole.finAbonnement.split('-').reverse().join('/');
  });
  if (erreur) return erreur;
  refresh();
  return { succes: `Paiement enregistré : abonnement payé jusqu'au ${fin}.` };
}

export async function annulerPaiement(
  id: string,
  paiementId: string,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/plateforme/ecoles/${id}/paiements/${paiementId}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Paiement annulé.' };
}

export async function suspendre(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/plateforme/ecoles/${id}/suspendre`, 'POST', {
      motif: texte(d, 'motif'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'École suspendue.' };
}

export async function reactiver(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/plateforme/ecoles/${id}/reactiver`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'École réactivée.' };
}

export async function reinitialiserDirection(
  id: string,
  utilisateurId: string,
): Promise<Etat> {
  let motDePasse = '';
  const erreur = await tenter(async () => {
    const r = await envoyerApi<{ motDePasseProvisoire: string }>(
      `/plateforme/ecoles/${id}/direction/${utilisateurId}/reinitialiser`,
      'POST',
    );
    motDePasse = r.motDePasseProvisoire;
  });
  if (erreur) return erreur;
  return {
    succes: `Nouveau mot de passe provisoire (affiché une seule fois) : ${motDePasse}`,
  };
}
