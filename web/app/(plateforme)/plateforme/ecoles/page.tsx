import type { Metadata } from 'next';
import Link from 'next/link';
import { TableauEcoles } from '@/components/plateforme';
import { EnTete, parametre, Saisie, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  LIBELLES_ETAT_ABONNEMENT,
  type EcolePlateforme,
  type EtatAbonnement,
} from '@/lib/types';

export const metadata: Metadata = {
  title: 'Écoles · Concepteur · Suivi_eleve',
};

const ETATS = Object.keys(LIBELLES_ETAT_ABONNEMENT) as EtatAbonnement[];

const filtre = (actif: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${
    actif
      ? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
  }`;

export default async function Ecoles(props: PageProps<'/plateforme/ecoles'>) {
  const params = await props.searchParams;
  const etat = parametre(params.etat);
  const recherche = parametre(params.recherche);
  const requete = new URLSearchParams();
  if (etat) requete.set('etat', etat);
  if (recherche) requete.set('recherche', recherche);
  const ecoles = await lireApi<EcolePlateforme[]>(
    `/plateforme/ecoles?${requete}`,
  );
  const lien = (e?: string) => {
    const p = new URLSearchParams();
    if (e) p.set('etat', e);
    if (recherche) p.set('recherche', recherche);
    return `/plateforme/ecoles${p.size ? `?${p}` : ''}`;
  };

  return (
    <>
      <EnTete
        titre="Écoles abonnées"
        sousTitre={`${ecoles.length} école${ecoles.length > 1 ? 's' : ''}`}
        actions={
          <Link href="/plateforme/ecoles/nouvelle" className={styles.bouton}>
            Nouvelle école
          </Link>
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        {etat && <input type="hidden" name="etat" value={etat} />}
        <div className="w-64">
          <Saisie
            name="recherche"
            defaultValue={recherche}
            placeholder="Rechercher une école"
            aria-label="Rechercher une école"
          />
        </div>
        <button type="submit" className={styles.boutonSecondaire}>
          Rechercher
        </button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={lien()} className={filtre(!etat)}>
          Toutes
        </Link>
        {ETATS.map((e) => (
          <Link key={e} href={lien(e)} className={filtre(etat === e)}>
            {LIBELLES_ETAT_ABONNEMENT[e]}
          </Link>
        ))}
      </div>
      <TableauEcoles ecoles={ecoles} vide="Aucune école pour ces critères." />
    </>
  );
}
