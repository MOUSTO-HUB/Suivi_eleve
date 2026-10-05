import Link from 'next/link';
import { Navigation } from '@/components/navigation';
import { styles } from '@/components/ui';
import { profilCourant } from '@/lib/profil';
import { LIBELLES_ROLE } from '@/lib/types';
import { seDeconnecter } from '../connexion/actions';

export default async function LayoutAdmin({ children }: LayoutProps<'/'>) {
  const profil = await profilCourant();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/eleves"
              className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Suivi_eleve
            </Link>
            <Navigation role={profil.role} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {profil.prenoms} {profil.nom} · {LIBELLES_ROLE[profil.role]}
            </span>
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
