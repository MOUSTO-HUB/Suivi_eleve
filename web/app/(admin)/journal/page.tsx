import type { Metadata } from 'next';
import {
  cellule,
  EnTete,
  Liste,
  Pagination,
  parametre,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { dateHeureFr, LIBELLES_ROLE, type Page, type Role } from '@/lib/types';

export const metadata: Metadata = { title: "Journal d'audit · Suivi_eleve" };

interface LigneAudit {
  id: string;
  action: string;
  entite: string;
  entiteId: string | null;
  details: unknown;
  ip: string | null;
  creeLe: string;
  utilisateur: { prenoms: string; nom: string; role: Role } | null;
}

const ACTIONS: Record<string, string> = {
  CONNEXION: 'Connexion',
  CREATION: 'Création',
  MODIFICATION: 'Modification',
  ARCHIVAGE: 'Archivage',
  SUPPRESSION: 'Suppression',
  EXPORT: 'Export',
};

/** Qui a fait quoi, quand et d'où : connexions, exports, effacements, modifications. */
export default async function Journal(props: PageProps<'/journal'>) {
  const params = await props.searchParams;
  const action = parametre(params.action);
  const page = parametre(params.page) ?? '1';
  const recherche = new URLSearchParams({ page, parPage: '50' });
  if (action) recherche.set('action', action);
  const journal = await lireApi<Page<LigneAudit>>(`/audit?${recherche}`);

  return (
    <>
      <EnTete
        titre="Journal d'audit"
        sousTitre="Actions sensibles enregistrées par l'application (direction seulement)"
      />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Liste name="action" defaultValue={action ?? ''} className="max-w-xs">
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </Liste>
        <button type="submit" className={styles.boutonSecondaire}>
          Filtrer
        </button>
      </form>
      <Tableau
        entetes={['Date', 'Qui', 'Action', 'Objet', 'Détails', 'IP']}
        vide={journal.total === 0 ? 'Aucune action enregistrée.' : undefined}
      >
        {journal.elements.map((l) => (
          <tr key={l.id}>
            <td className={cellule}>{dateHeureFr(l.creeLe)}</td>
            <td className={cellule}>
              {l.utilisateur
                ? `${l.utilisateur.prenoms} ${l.utilisateur.nom} (${LIBELLES_ROLE[l.utilisateur.role]})`
                : '—'}
            </td>
            <td className={cellule}>{ACTIONS[l.action] ?? l.action}</td>
            <td className={cellule}>
              {l.entite}
              {l.entiteId && (
                <span className="block font-mono text-xs text-slate-500">
                  {l.entiteId.slice(0, 8)}
                </span>
              )}
            </td>
            <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-600">
              {l.details ? JSON.stringify(l.details) : ''}
            </td>
            <td className={cellule}>{l.ip ?? '—'}</td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={journal.page}
        pages={journal.pages}
        total={journal.total}
        chemin="/journal"
        parametres={{ action }}
      />
    </>
  );
}
