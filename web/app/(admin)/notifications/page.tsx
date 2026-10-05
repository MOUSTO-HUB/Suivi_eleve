import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  cellule,
  EnTete,
  Liste,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  dateHeureFr,
  LIBELLES_CANAL,
  LIBELLES_STATUT_NOTIFICATION,
  LIBELLES_TYPE_NOTIFICATION,
  type NotificationJournal,
  type Page,
  type StatistiquesNotifications,
  type StatutNotification,
} from '@/lib/types';
import { renvoyerNotification } from './actions';

export const metadata: Metadata = { title: 'Notifications · Suivi_eleve' };

const COULEUR: Record<StatutNotification, 'gris' | 'vert' | 'orange'> = {
  EN_FILE: 'gris',
  ENVOYEE: 'vert',
  DELIVREE: 'vert',
  LUE: 'vert',
  ECHOUEE: 'orange',
};

function Chiffre({
  libelle,
  valeur,
  aide,
}: {
  libelle: string;
  valeur: string;
  aide?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {libelle}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {valeur}
      </p>
      {aide && <p className="text-xs text-zinc-500">{aide}</p>}
    </div>
  );
}

export default async function PageNotifications(
  props: PageProps<'/notifications'>,
) {
  const sp = await props.searchParams;
  const filtres = {
    type: parametre(sp.type),
    canal: parametre(sp.canal),
    statut: parametre(sp.statut),
    du: parametre(sp.du),
    au: parametre(sp.au),
    q: parametre(sp.q),
  };
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur) requete.set(cle, valeur);
  }
  const [journal, stats] = await Promise.all([
    lireApi<Page<NotificationJournal>>(
      `/notifications/journal?${requete.toString()}`,
    ),
    lireApi<StatistiquesNotifications>('/notifications/statistiques'),
  ]);
  const total = (canal: 'SMS' | 'EMAIL' | 'PUSH') =>
    Object.values(stats.parCanal[canal] ?? {}).reduce(
      (s, n) => s + (n ?? 0),
      0,
    );
  const echecs = (['SMS', 'EMAIL', 'PUSH'] as const).reduce(
    (s, c) => s + (stats.parCanal[c]?.ECHOUEE ?? 0),
    0,
  );

  return (
    <>
      <EnTete
        titre="Notifications"
        sousTitre="Journal des SMS, emails et notifications push envoyés aux familles"
        actions={
          <Link
            className={styles.boutonSecondaire}
            href="/notifications/modeles"
          >
            Modèles de messages
          </Link>
        }
      />

      <Carte titre={`Ce mois-ci (${stats.mois})`}>
        <div className="grid gap-6 sm:grid-cols-5">
          <Chiffre
            libelle="SMS"
            valeur={String(total('SMS'))}
            aide={
              stats.sms.plafond ? `plafond ${stats.sms.plafond}` : undefined
            }
          />
          <Chiffre
            libelle="Coût SMS"
            valeur={`${stats.sms.cout.toLocaleString('fr-FR')} FCFA`}
          />
          <Chiffre libelle="Emails" valeur={String(total('EMAIL'))} />
          <Chiffre libelle="Push" valeur={String(total('PUSH'))} />
          <Chiffre libelle="Échecs" valeur={String(echecs)} />
        </div>
      </Carte>

      <form
        role="search"
        className="my-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr_150px_150px_auto] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <Saisie
          name="q"
          defaultValue={filtres.q}
          placeholder="Numéro ou email"
          aria-label="Destinataire"
        />
        <Liste name="type" defaultValue={filtres.type ?? ''} aria-label="Type">
          <option value="">Tous les types</option>
          {Object.entries(LIBELLES_TYPE_NOTIFICATION).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Liste>
        <Liste
          name="canal"
          defaultValue={filtres.canal ?? ''}
          aria-label="Canal"
        >
          <option value="">Tous les canaux</option>
          {(['SMS', 'EMAIL', 'PUSH'] as const).map((c) => (
            <option key={c} value={c}>
              {LIBELLES_CANAL[c]}
            </option>
          ))}
        </Liste>
        <Liste
          name="statut"
          defaultValue={filtres.statut ?? ''}
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUT_NOTIFICATION).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Liste>
        <Saisie
          type="date"
          name="du"
          defaultValue={filtres.du}
          aria-label="Du"
        />
        <Saisie
          type="date"
          name="au"
          defaultValue={filtres.au}
          aria-label="Au"
        />
        <button type="submit" className={styles.bouton}>
          Filtrer
        </button>
      </form>

      <Tableau
        entetes={[
          'Date',
          'Type',
          'Canal',
          'Destinataire',
          'Élève',
          'Statut',
          'Message',
          '',
        ]}
        vide={
          journal.total === 0
            ? 'Aucun envoi ne correspond à ces critères.'
            : undefined
        }
      >
        {journal.elements.map((n) => (
          <tr key={n.id} className="align-top">
            <td className={cellule}>{dateHeureFr(n.creeLe)}</td>
            <td className={cellule}>{LIBELLES_TYPE_NOTIFICATION[n.type]}</td>
            <td className={cellule}>{LIBELLES_CANAL[n.canal]}</td>
            <td className={cellule}>
              <span
                className="block max-w-[14rem] truncate font-mono text-xs"
                title={n.destinataire}
              >
                {n.destinataire}
              </span>
              <span className="text-xs text-zinc-500">
                {n.tuteur.prenoms} {n.tuteur.nom}
              </span>
            </td>
            <td className={cellule}>
              {n.eleve ? (
                <Link className={styles.lien} href={`/eleves/${n.eleve.id}`}>
                  {n.eleve.prenoms} {n.eleve.nom}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className={cellule}>
              <Badge couleur={COULEUR[n.statut]}>
                {LIBELLES_STATUT_NOTIFICATION[n.statut]}
              </Badge>
              <span className="block text-xs text-zinc-500">
                {n.essais} essai{n.essais > 1 ? 's' : ''}
                {n.fournisseur ? ` · ${n.fournisseur}` : ''}
              </span>
              {n.erreur && (
                <span className="block max-w-[16rem] whitespace-normal text-xs text-red-700 dark:text-red-400">
                  {n.erreur}
                </span>
              )}
            </td>
            <td className={`${cellule} whitespace-normal`}>
              <details className="max-w-xs text-xs">
                <summary className="cursor-pointer truncate">
                  {n.sujet ?? n.contenu}
                </summary>
                <p className="mt-1 whitespace-pre-line text-zinc-600 dark:text-zinc-400">
                  {n.contenu}
                </p>
              </details>
            </td>
            <td className={cellule}>
              {n.statut === 'ECHOUEE' && (
                <FormulaireAction
                  action={renvoyerNotification.bind(null, n.id)}
                  libelle="Renvoyer"
                  libelleEnCours="…"
                  style="boutonSecondaire"
                  className="flex flex-col gap-1"
                />
              )}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={journal.page}
        pages={journal.pages}
        total={journal.total}
        chemin="/notifications"
        parametres={filtres}
      />
    </>
  );
}
