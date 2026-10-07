import Link from 'next/link';
import type { ReactNode } from 'react';
import { seDeconnecter } from '@/app/connexion/actions';
import { ChoixTheme } from '@/components/choix-theme';
import { themeCourant } from '@/lib/theme-serveur';

/** Toque de diplômé de l'icône de l'application. */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`fond-degrade inline-flex shrink-0 items-center justify-center rounded-xl shadow-md ring-1 ring-white/30 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 512 512" className="h-2/3 w-2/3" fill="#fff">
        <g transform="translate(0 -14)">
          <polygon points="256,148 440,230 256,312 72,230" />
          <path d="M152 266 v74 c0 30 46 54 104 54 s104 -24 104 -54 v-74 l-104 46 z" />
          <rect x="430" y="228" width="12" height="98" rx="6" />
          <circle cx="436" cy="334" r="16" />
        </g>
      </svg>
    </span>
  );
}

/** Bandeau du haut commun aux espaces : logo, utilisateur, déconnexion. */
export async function Bandeau({
  accueil,
  espace,
  utilisateur,
  compte,
  largeur = 'max-w-6xl',
}: {
  accueil: string;
  /** Nom de l'espace affiché sous le logo (« Concepteur »…). */
  espace?: string;
  utilisateur: ReactNode;
  /** Page « Mon compte » (le nom devient un lien). */
  compte?: string;
  largeur?: string;
}) {
  return (
    <header className="fond-bandeau text-white shadow-lg shadow-black/20">
      <div
        className={`mx-auto flex ${largeur} items-center justify-between gap-3 px-4 py-3`}
      >
        <Link href={accueil} className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight">
              Suivi_eleve
            </span>
            {espace && (
              <span className="truncate text-xs font-medium text-soleil-300">
                {espace}
              </span>
            )}
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 text-sm sm:gap-2">
          <ChoixTheme initial={await themeCourant()} />
          {compte ? (
            <Link
              href={compte}
              title="Mon compte"
              className="shrink-0 truncate rounded-full text-white/90 hover:bg-white/10 hover:text-white sm:shrink sm:px-3 sm:py-1.5"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/40 sm:hidden"
                aria-label="Mon compte"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="#fff"
                  aria-hidden
                >
                  <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 1 1 14 0z" />
                </svg>
              </span>
              <span className="hidden sm:inline">{utilisateur}</span>
            </Link>
          ) : (
            <span className="hidden truncate text-white/90 sm:block">
              {utilisateur}
            </span>
          )}
          <form action={seDeconnecter}>
            <button
              type="submit"
              className="rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white backdrop-blur transition hover:bg-white/20"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
