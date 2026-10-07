import type { Metadata } from 'next';
import Link from 'next/link';
import { TableauEcoles } from '@/components/plateforme';
import { Carte, EnTete, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  gnf,
  LIBELLES_ETAT_ABONNEMENT,
  type EtatAbonnement,
  type TableauDeBordPlateforme,
} from '@/lib/types';

export const metadata: Metadata = {
  title: 'Tableau de bord · Concepteur · Suivi_eleve',
};

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-2xl border border-marque-100 bg-carte shadow-sm shadow-marque-900/5 p-4">
      <p className="text-sm text-slate-500">{libelle}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valeur}</p>
    </div>
  );
}

/** Vue d'ensemble des écoles abonnées et des encaissements. */
export default async function TableauDeBord() {
  const t = await lireApi<TableauDeBordPlateforme>(
    '/plateforme/tableau-de-bord',
  );
  return (
    <>
      <EnTete
        titre="Tableau de bord"
        sousTitre={`Tarif : ${gnf(t.tarifs.MENSUEL)} par mois et par école, ou ${gnf(t.tarifs.ANNUEL)} par an (sans TVA). Essai de ${t.regles.joursEssai} jours, ${t.regles.joursGrace} jours de grâce avant suspension.`}
        actions={
          <Link href="/plateforme/ecoles/nouvelle" className={styles.bouton}>
            Nouvelle école
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre libelle="Écoles abonnées" valeur={String(t.ecoles.total)} />
        <Chiffre libelle="Élèves suivis" valeur={String(t.eleves)} />
        <Chiffre
          libelle="Encaissé ce mois"
          valeur={gnf(t.encaissements.mois)}
        />
        <Chiffre
          libelle="Encaissé cette année"
          valeur={gnf(t.encaissements.annee)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {(Object.keys(t.ecoles.parEtat) as EtatAbonnement[]).map((etat) => (
          <Link
            key={etat}
            href={`/plateforme/ecoles?etat=${etat}`}
            className="rounded-full border border-slate-200 bg-carte px-3 py-1 hover:bg-marque-50/60"
          >
            {LIBELLES_ETAT_ABONNEMENT[etat]} :{' '}
            <strong className="tabular-nums">{t.ecoles.parEtat[etat]}</strong>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Carte titre="Écoles à relancer">
          <p className="mb-3 text-sm text-slate-600">
            Fin d’abonnement dans moins de {t.regles.joursAvertissement} jours,
            en retard, ou suspendues faute de paiement.
          </p>
          <TableauEcoles
            ecoles={t.aRelancer}
            vide="Aucune école à relancer : tout est à jour."
          />
        </Carte>
      </div>
    </>
  );
}
