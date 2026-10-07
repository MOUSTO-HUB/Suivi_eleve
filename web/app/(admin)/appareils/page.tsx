import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeStatut } from '@/components/appareils';
import {
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
import { profilCourant } from '@/lib/profil';
import {
  designationAppareil,
  LIBELLES_STATUT_APPAREIL,
  type Appareil,
  type Classe,
  type Page,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Appareils · Suivi_eleve' };

export default async function PageAppareils(props: PageProps<'/appareils'>) {
  const sp = await props.searchParams;
  const filtres = {
    q: parametre(sp.q),
    statut: parametre(sp.statut),
    classeId: parametre(sp.classeId),
  };
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur) requete.set(cle, valeur);
  }
  const [appareils, classes, profil] = await Promise.all([
    lireApi<Page<Appareil>>(`/appareils?${requete.toString()}`),
    lireApi<Classe[]>('/classes'),
    profilCourant(),
  ]);
  const etiquettes = ['ADMIN', 'SECRETARIAT', 'SURVEILLANT'].includes(
    profil.role,
  );

  return (
    <>
      <EnTete
        titre="Appareils"
        sousTitre="Téléphones, tablettes et ordinateurs des élèves"
        actions={
          etiquettes &&
          filtres.classeId && (
            <a
              className={styles.boutonSecondaire}
              href={`/telechargements/etiquettes?classeId=${filtres.classeId}`}
            >
              Étiquettes QR de la classe (PDF)
            </a>
          )
        }
      />

      <form
        role="search"
        className="mb-4 grid gap-3 rounded-2xl border border-marque-100 bg-carte shadow-sm shadow-marque-900/5 p-4 sm:grid-cols-[1fr_180px_160px_auto]"
      >
        <Saisie
          name="q"
          defaultValue={filtres.q}
          placeholder="IMEI, n° de série, code de l'étiquette, marque, couleur, élève"
          aria-label="Rechercher un appareil"
          autoFocus
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
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUT_APPAREIL).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </Liste>
        <button type="submit" className={styles.bouton}>
          Rechercher
        </button>
      </form>

      <Tableau
        entetes={['Code', 'Appareil', 'Élève', 'Classe', 'Statut']}
        vide={
          appareils.total === 0
            ? 'Aucun appareil ne correspond à cette recherche.'
            : undefined
        }
      >
        {appareils.elements.map((a) => (
          <tr key={a.id} className="hover:bg-marque-50/60">
            <td className={`${cellule} font-mono text-xs`}>{a.codeCourt}</td>
            <td className={cellule}>
              <Link className={styles.lien} href={`/appareils/${a.id}`}>
                {designationAppareil(a)}
              </Link>
              {a.signesDistinctifs && (
                <span className="block max-w-xs truncate text-xs text-slate-500">
                  {a.signesDistinctifs}
                </span>
              )}
            </td>
            <td className={cellule}>
              <Link className={styles.lien} href={`/eleves/${a.eleve.id}`}>
                {a.eleve.nom} {a.eleve.prenoms}
              </Link>
            </td>
            <td className={cellule}>{a.eleve.classe?.nom ?? '—'}</td>
            <td className={cellule}>
              <BadgeStatut statut={a.statut} />
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={appareils.page}
        pages={appareils.pages}
        total={appareils.total}
        chemin="/appareils"
        parametres={filtres}
      />
    </>
  );
}
