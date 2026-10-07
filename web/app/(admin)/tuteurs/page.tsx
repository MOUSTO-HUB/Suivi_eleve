import type { Metadata } from 'next';
import Link from 'next/link';
import {
  cellule,
  EnTete,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { Page, TuteurListe } from '@/lib/types';

export const metadata: Metadata = { title: 'Tuteurs · Suivi_eleve' };

export default async function PageTuteurs(props: PageProps<'/tuteurs'>) {
  const sp = await props.searchParams;
  const q = parametre(sp.q);
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  if (q) requete.set('q', q);
  const tuteurs = await lireApi<Page<TuteurListe>>(
    `/tuteurs?${requete.toString()}`,
  );

  return (
    <>
      <EnTete
        titre="Tuteurs"
        sousTitre="Les tuteurs sont créés à l'inscription d'un élève."
      />
      <form
        role="search"
        className="mb-4 flex gap-3 rounded-2xl border border-marque-100 bg-white shadow-sm shadow-marque-900/5 p-4"
      >
        <Saisie
          name="q"
          defaultValue={q}
          placeholder="Nom, prénom, téléphone ou email"
          aria-label="Rechercher un tuteur"
        />
        <button type="submit" className={styles.bouton}>
          Rechercher
        </button>
      </form>

      <Tableau
        entetes={[
          'Tuteur',
          'Contact_tuteur_1',
          'Contact_tuteur_2',
          'Email',
          'Élèves',
        ]}
        vide={
          tuteurs.total === 0
            ? 'Aucun tuteur ne correspond à cette recherche.'
            : undefined
        }
      >
        {tuteurs.elements.map((t) => (
          <tr key={t.id} className="hover:bg-marque-50/60">
            <td className={cellule}>
              <Link className={styles.lien} href={`/tuteurs/${t.id}`}>
                {t.nom} {t.prenoms}
              </Link>
            </td>
            <td className={`${cellule} font-mono text-xs`}>{t.contact1}</td>
            <td className={`${cellule} font-mono text-xs`}>
              {t.contact2 ?? '—'}
            </td>
            <td className={cellule}>{t.email ?? '—'}</td>
            <td className={cellule}>{t.nombreEleves}</td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={tuteurs.page}
        pages={tuteurs.pages}
        total={tuteurs.total}
        chemin="/tuteurs"
        parametres={{ q }}
      />
    </>
  );
}
