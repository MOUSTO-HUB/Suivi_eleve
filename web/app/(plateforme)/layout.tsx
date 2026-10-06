import Link from 'next/link';
import { redirect } from 'next/navigation';
import { styles } from '@/components/ui';
import { profilCourant } from '@/lib/profil';
import { accueilDuRole } from '@/lib/types';
import { seDeconnecter } from '../connexion/actions';

const LIENS = [
  ['/plateforme', 'Tableau de bord'],
  ['/plateforme/ecoles', 'Écoles'],
  ['/plateforme/ecoles/nouvelle', 'Nouvelle école'],
] as const;

/** Espace concepteur : réservé au SUPER_ADMIN (aucune donnée d'élève). */
export default async function LayoutPlateforme({ children }: LayoutProps<'/'>) {
  const profil = await profilCourant();
  if (profil.role !== 'SUPER_ADMIN') redirect(accueilDuRole(profil.role));
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/plateforme"
              className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Suivi_eleve{' '}
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                · Concepteur
              </span>
            </Link>
            <nav
              aria-label="Espace concepteur"
              className="flex flex-wrap gap-1"
            >
              {LIENS.map(([href, libelle]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  {libelle}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/plateforme/compte"
              title="Mon compte"
              className="text-zinc-600 hover:underline dark:text-zinc-400"
            >
              {profil.prenoms} {profil.nom}
            </Link>
            <form action={seDeconnecter}>
              <button type="submit" className={styles.boutonSecondaire}>
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
