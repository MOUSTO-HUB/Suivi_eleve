import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
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
import { peutGererDossiers } from '@/lib/profil';
import { dateFr, type Classe, type Eleve, type Page } from '@/lib/types';

export const metadata: Metadata = { title: 'Élèves · Suivi_eleve' };

export default async function PageEleves(props: PageProps<'/eleves'>) {
  const sp = await props.searchParams;
  const filtres = {
    q: parametre(sp.q),
    classeId: parametre(sp.classeId),
    statut: parametre(sp.statut),
  };
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur) requete.set(cle, valeur);
  }

  const [eleves, classes, gestion] = await Promise.all([
    lireApi<Page<Eleve>>(`/eleves?${requete.toString()}`),
    lireApi<Classe[]>('/classes'),
    peutGererDossiers(),
  ]);
  const exportCsv = new URLSearchParams({
    ...nettoyer(filtres),
    format: 'csv',
  });
  const exportXlsx = new URLSearchParams({
    ...nettoyer(filtres),
    format: 'xlsx',
  });

  return (
    <>
      <EnTete
        titre="Élèves"
        sousTitre={`${eleves.total} élève${eleves.total > 1 ? 's' : ''} ${
          filtres.statut === 'ARCHIVE' ? 'archivé(s)' : 'inscrit(s)'
        }`}
        actions={
          <>
            <a
              className={styles.boutonSecondaire}
              href={`/telechargements/eleves?${exportXlsx}`}
            >
              Exporter (Excel)
            </a>
            <a
              className={styles.boutonSecondaire}
              href={`/telechargements/eleves?${exportCsv}`}
            >
              Exporter (CSV)
            </a>
            {gestion && (
              <>
                <Link className={styles.boutonSecondaire} href="/eleves/import">
                  Importer
                </Link>
                <Link className={styles.bouton} href="/eleves/nouveau">
                  Nouvel élève
                </Link>
              </>
            )}
          </>
        }
      />

      <form
        role="search"
        className="mb-4 grid gap-3 rounded-2xl border border-marque-100 bg-white shadow-sm shadow-marque-900/5 p-4 sm:grid-cols-[1fr_200px_160px_auto]"
      >
        <Saisie
          name="q"
          defaultValue={filtres.q}
          placeholder="Nom, prénom, matricule, tuteur ou téléphone"
          aria-label="Rechercher"
        />
        <Liste
          name="classeId"
          defaultValue={filtres.classeId ?? ''}
          aria-label="Classe"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Liste>
        <Liste
          name="statut"
          defaultValue={filtres.statut ?? ''}
          aria-label="Statut"
        >
          <option value="">Actifs</option>
          <option value="ARCHIVE">Archivés</option>
        </Liste>
        <button type="submit" className={styles.bouton}>
          Rechercher
        </button>
      </form>

      <Tableau
        entetes={[
          'Matricule',
          'Élève',
          'Âge',
          'Classe',
          'Tuteur principal',
          'Contact',
        ]}
        vide={
          eleves.total === 0
            ? 'Aucun élève ne correspond à cette recherche.'
            : undefined
        }
      >
        {eleves.elements.map((e) => {
          const tuteur = e.tuteurs[0];
          return (
            <tr key={e.id} className="hover:bg-marque-50/60">
              <td className={`${cellule} font-mono text-xs`}>{e.matricule}</td>
              <td className={cellule}>
                <Link className={styles.lien} href={`/eleves/${e.id}`}>
                  {e.nom} {e.prenoms}
                </Link>
                {e.statut === 'ARCHIVE' && (
                  <span className="ml-2">
                    <Badge couleur="orange">Archivé</Badge>
                  </span>
                )}
              </td>
              <td
                className={cellule}
                title={`Né(e) le ${dateFr(e.dateNaissance)}`}
              >
                {e.age} ans
              </td>
              <td className={cellule}>{e.classe?.nom ?? '—'}</td>
              <td className={cellule}>
                {tuteur ? `${tuteur.prenoms} ${tuteur.nom}` : '—'}
              </td>
              <td className={`${cellule} font-mono text-xs`}>
                {tuteur?.contact1 ?? '—'}
              </td>
            </tr>
          );
        })}
      </Tableau>

      <Pagination
        page={eleves.page}
        pages={eleves.pages}
        total={eleves.total}
        chemin="/eleves"
        parametres={filtres}
      />
    </>
  );
}

const nettoyer = (o: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Record<
    string,
    string
  >;
