import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

// Briques d'interface communes, utilisables côté serveur comme côté client.

const champ =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

export const styles = {
  champ,
  bouton:
    'inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60',
  boutonSecondaire:
    'inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  boutonDanger:
    'inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400',
  lien: 'font-medium text-emerald-700 hover:underline dark:text-emerald-400',
};

export function Champ({
  libelle,
  aide,
  obligatoire,
  children,
}: {
  libelle: string;
  aide?: string;
  obligatoire?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        {libelle}
        {obligatoire && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {aide && <span className="text-xs text-zinc-500">{aide}</span>}
    </label>
  );
}

export function Saisie(props: ComponentProps<'input'>) {
  return <input {...props} className={`${champ} ${props.className ?? ''}`} />;
}

export function Liste(props: ComponentProps<'select'>) {
  return <select {...props} className={`${champ} ${props.className ?? ''}`} />;
}

export function Alerte({
  type = 'erreur',
  children,
}: {
  type?: 'erreur' | 'succes' | 'info';
  children: ReactNode;
}) {
  const couleurs = {
    erreur:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
    succes:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  };
  return (
    <div
      role={type === 'erreur' ? 'alert' : 'status'}
      className={`rounded-md border px-4 py-3 text-sm ${couleurs[type]}`}
    >
      {children}
    </div>
  );
}

export function Carte({
  titre,
  actions,
  children,
}: {
  titre?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {(titre || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titre && (
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {titre}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EnTete({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {titre}
        </h1>
        {sousTitre && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {sousTitre}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  couleur = 'gris',
  children,
}: {
  couleur?: 'gris' | 'vert' | 'orange';
  children: ReactNode;
}) {
  const c = {
    gris: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    vert: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    orange: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  }[couleur];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c}`}
    >
      {children}
    </span>
  );
}

/** Tableau responsive : défile horizontalement sur petit écran. */
export function Tableau({
  entetes,
  children,
  vide,
}: {
  entetes: string[];
  children: ReactNode;
  vide?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-950">
          <tr>
            {entetes.map((e) => (
              <th
                key={e}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400"
              >
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {children}
        </tbody>
      </table>
      {vide && (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">{vide}</p>
      )}
    </div>
  );
}

export const cellule =
  'whitespace-nowrap px-4 py-3 text-zinc-800 dark:text-zinc-200';

/** Liens Précédent / Suivant qui conservent les autres paramètres de recherche. */
export function Pagination({
  page,
  pages,
  total,
  chemin,
  parametres,
}: {
  page: number;
  pages: number;
  total: number;
  chemin: string;
  parametres: Record<string, string | undefined>;
}) {
  const vers = (p: number) => {
    const sp = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(parametres)) {
      if (valeur) sp.set(cle, valeur);
    }
    sp.set('page', String(p));
    return `${chemin}?${sp.toString()}`;
  };
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400"
    >
      <span>
        {total} résultat{total > 1 ? 's' : ''} · page{' '}
        {Math.min(page, Math.max(pages, 1))} sur {Math.max(pages, 1)}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className={styles.boutonSecondaire} href={vers(page - 1)}>
            Précédent
          </Link>
        )}
        {page < pages && (
          <Link className={styles.boutonSecondaire} href={vers(page + 1)}>
            Suivant
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Premier élément d'un paramètre de recherche Next (string | string[]). */
export const parametre = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;
