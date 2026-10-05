import Link from 'next/link';
import { redirect } from 'next/navigation';
import { styles } from '@/components/ui';
import { profilCourant } from '@/lib/profil';
import { seDeconnecter } from '../connexion/actions';

/** Espace parents : réservé aux comptes PARENT (le personnel a son propre espace). */
export default async function LayoutParent({ children }: LayoutProps<'/'>) {
  const profil = await profilCourant();
  if (profil.role !== 'PARENT') redirect('/eleves');
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/parent"
            className="text-lg font-semibold tracking-tight text-emerald-800 dark:text-emerald-300"
          >
            Suivi_eleve
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">
              {profil.prenoms} {profil.nom}
            </span>
            <form action={seDeconnecter}>
              <button type="submit" className={styles.boutonSecondaire}>
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
