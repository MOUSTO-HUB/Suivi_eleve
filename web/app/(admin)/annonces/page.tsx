import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
  cellule,
  EnTete,
  Pagination,
  parametre,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import {
  dateHeureFr,
  LIBELLES_MOTIF_ANNONCE,
  LIBELLES_STATUT_ANNONCE,
  type AnnonceListe,
  type Page,
  type StatutAnnonce,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Annonces · Suivi_eleve' };

const COULEUR: Record<StatutAnnonce, 'gris' | 'vert' | 'orange'> = {
  BROUILLON: 'gris',
  PROGRAMMEE: 'orange',
  ENVOYEE: 'vert',
  ANNULEE: 'gris',
};

export default async function PageAnnonces(props: PageProps<'/annonces'>) {
  const page = parametre((await props.searchParams).page) ?? '1';
  const [annonces, gestion] = await Promise.all([
    lireApi<Page<AnnonceListe>>(`/annonces?page=${page}`),
    peutGererDossiers(),
  ]);

  return (
    <>
      <EnTete
        titre="Annonces"
        sousTitre="Libérations anticipées et absences de cours"
        actions={
          gestion && (
            <>
              <Link
                className={styles.boutonSecondaire}
                href="/annonces/nouvelle?type=PAS_DE_COURS"
              >
                Pas de cours
              </Link>
              <Link
                className={styles.bouton}
                href="/annonces/nouvelle?type=LIBERATION_ANTICIPEE"
              >
                Libération anticipée
              </Link>
            </>
          )
        }
      />
      <Tableau
        entetes={['Annonce', 'Motif', 'Statut', 'Familles', 'Lu', 'Par']}
        vide={
          annonces.total === 0 ? 'Aucune annonce pour le moment.' : undefined
        }
      >
        {annonces.elements.map((a) => (
          <tr key={a.id} className="hover:bg-marque-50/60">
            <td className={cellule}>
              <Link className={styles.lien} href={`/annonces/${a.id}`}>
                {a.titre}
              </Link>
            </td>
            <td className={cellule}>
              {a.motif === 'AUTRE'
                ? a.motifDetail
                : a.motif && LIBELLES_MOTIF_ANNONCE[a.motif]}
            </td>
            <td className={cellule}>
              <Badge couleur={COULEUR[a.statut]}>
                {LIBELLES_STATUT_ANNONCE[a.statut]}
              </Badge>
              <span className="block text-xs text-slate-500">
                {a.statut === 'PROGRAMMEE' && a.programmeeLe
                  ? `pour le ${dateHeureFr(a.programmeeLe)}`
                  : a.envoyeeLe
                    ? dateHeureFr(a.envoyeeLe)
                    : ''}
              </span>
            </td>
            <td className={cellule}>{a.familles}</td>
            <td className={cellule}>
              {a.familles
                ? `${Math.round((a.lues / a.familles) * 100)} %`
                : '—'}
            </td>
            <td className={cellule}>
              {a.auteur ? `${a.auteur.prenoms} ${a.auteur.nom}` : '—'}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={annonces.page}
        pages={annonces.pages}
        total={annonces.total}
        chemin="/annonces"
        parametres={{}}
      />
    </>
  );
}
