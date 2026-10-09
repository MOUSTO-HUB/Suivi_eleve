import type { ReactNode } from 'react';
import { Logo } from '@/components/bandeau';
import { ChoixTheme } from '@/components/choix-theme';
import { themeCourant } from '@/lib/theme-serveur';

/** Cadre des pages ouvertes sans connexion (mot de passe oublié…), comme la page de connexion. */
export async function CadrePublic({
  titre,
  children,
}: {
  titre: string;
  children: ReactNode;
}) {
  return (
    <main className="fond-bandeau relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ChoixTheme initial={await themeCourant()} />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
          <Logo className="h-12 w-12" />
          Suivi_eleve
        </h1>
        <p className="mt-2 mb-6 text-sm text-white/85">{titre}</p>
        <div className="rounded-2xl bg-carte p-6 shadow-2xl shadow-black/40">
          {children}
        </div>
      </div>
    </main>
  );
}
