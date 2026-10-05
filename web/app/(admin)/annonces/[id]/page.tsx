import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import { RafraichissementAuto } from '@/components/rafraichissement-auto';
import {
  Alerte,
  Badge,
  Carte,
  cellule,
  EnTete,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import {
  dateHeureFr,
  LIBELLES_CANAL,
  LIBELLES_MOTIF_ANNONCE,
  LIBELLES_STATUT_ANNONCE,
  type AnnonceSuivie,
  type StatutNotification,
} from '@/lib/types';
import { annulerAnnonce, envoyerAnnonce } from '../actions';

export const metadata: Metadata = { title: 'Suivi de l’annonce · Suivi_eleve' };

function Compteur({
  libelle,
  valeur,
  ton,
}: {
  libelle: string;
  valeur: number;
  ton?: 'ok' | 'alerte';
}) {
  const couleur =
    ton === 'alerte' && valeur > 0
      ? 'text-red-700 dark:text-red-400'
      : ton === 'ok'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-zinc-900 dark:text-zinc-50';
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {libelle}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${couleur}`}>{valeur}</p>
    </div>
  );
}

export default async function SuiviAnnonce(props: PageProps<'/annonces/[id]'>) {
  const { id } = await props.params;
  const annonce = await lireApiOuNull<AnnonceSuivie>(`/annonces/${id}`);
  if (!annonce) notFound();
  const { suivi } = annonce;
  const programmee = annonce.statut === 'PROGRAMMEE';
  const compte = (
    canal: 'SMS' | 'EMAIL' | 'PUSH',
    statuts: StatutNotification[],
  ) => statuts.reduce((s, st) => s + (suivi.parCanal[canal]?.[st] ?? 0), 0);

  return (
    <>
      <EnTete
        titre={annonce.titre}
        sousTitre={[
          annonce.motif &&
            (annonce.motif === 'AUTRE'
              ? annonce.motifDetail
              : LIBELLES_MOTIF_ANNONCE[annonce.motif]),
          annonce.creneau,
          annonce.auteur &&
            `par ${annonce.auteur.prenoms} ${annonce.auteur.nom}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Link className={styles.boutonSecondaire} href="/annonces">
            Toutes les annonces
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge couleur={annonce.statut === 'ENVOYEE' ? 'vert' : 'orange'}>
          {LIBELLES_STATUT_ANNONCE[annonce.statut]}
        </Badge>
        {annonce.envoyeeLe && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            le {dateHeureFr(annonce.envoyeeLe)}
          </span>
        )}
        <RafraichissementAuto actif={suivi.enCours || programmee} />
      </div>

      {programmee && (
        <Alerte type="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Envoi programmé le{' '}
              {annonce.programmeeLe && dateHeureFr(annonce.programmeeLe)}.
            </span>
            <span className="flex gap-2">
              <FormulaireAction
                action={envoyerAnnonce.bind(null, annonce.id)}
                libelle="Envoyer maintenant"
                confirmation="Envoyer maintenant aux familles ?"
                className="flex"
              />
              <FormulaireAction
                action={annulerAnnonce.bind(null, annonce.id)}
                libelle="Annuler l'envoi"
                style="boutonDanger"
                confirmation="Annuler cet envoi programmé ?"
                className="flex"
              />
            </span>
          </div>
        </Alerte>
      )}

      {annonce.message && (
        <Carte titre="Message complémentaire">
          <p className="whitespace-pre-line text-sm">{annonce.message}</p>
        </Carte>
      )}

      {!programmee && annonce.statut !== 'ANNULEE' && (
        <div className="mt-4 flex flex-col gap-6">
          <Carte titre="Familles prévenues">
            <div className="grid gap-6 sm:grid-cols-3">
              <Compteur libelle="Familles" valeur={suivi.familles} />
              <Compteur libelle="Ont lu" valeur={suivi.lues} ton="ok" />
              <Compteur
                libelle="Pas encore lu"
                valeur={suivi.familles - suivi.lues}
              />
            </div>
          </Carte>
          <Carte titre="Envois">
            <div className="grid gap-6 sm:grid-cols-3">
              {(['SMS', 'EMAIL', 'PUSH'] as const).map((canal) => (
                <div key={canal} className="text-sm">
                  <p className="mb-1 font-medium">{LIBELLES_CANAL[canal]}</p>
                  <p>En file : {compte(canal, ['EN_FILE'])}</p>
                  <p>
                    Envoyés : {compte(canal, ['ENVOYEE', 'DELIVREE', 'LUE'])}
                  </p>
                  <p>Délivrés : {compte(canal, ['DELIVREE', 'LUE'])}</p>
                  <p
                    className={
                      compte(canal, ['ECHOUEE'])
                        ? 'text-red-700 dark:text-red-400'
                        : ''
                    }
                  >
                    Échecs : {compte(canal, ['ECHOUEE'])}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Détail de chaque envoi dans le{' '}
              <Link className={styles.lien} href="/notifications">
                journal des notifications
              </Link>
              .
            </p>
          </Carte>
          <Carte
            titre={`Familles qui n'ont pas encore lu (${suivi.familles - suivi.lues})`}
          >
            <Tableau
              entetes={['Tuteur', 'Élève', 'Classe', 'Contact']}
              vide={
                suivi.nonLues.length === 0
                  ? 'Toutes les familles ont lu le message.'
                  : undefined
              }
            >
              {suivi.nonLues.map((n) => (
                <tr key={`${n.tuteur.id}`}>
                  <td className={cellule}>
                    {n.tuteur.prenoms} {n.tuteur.nom}
                  </td>
                  <td className={cellule}>
                    {n.eleve && (
                      <Link
                        className={styles.lien}
                        href={`/eleves/${n.eleve.id}`}
                      >
                        {n.eleve.prenoms} {n.eleve.nom}
                      </Link>
                    )}
                  </td>
                  <td className={cellule}>{n.eleve?.classe?.nom ?? '—'}</td>
                  <td className={cellule}>
                    <a
                      className={styles.lien}
                      href={`tel:${n.tuteur.contact1}`}
                    >
                      {n.tuteur.contact1}
                    </a>
                  </td>
                </tr>
              ))}
            </Tableau>
          </Carte>
        </div>
      )}
    </>
  );
}
