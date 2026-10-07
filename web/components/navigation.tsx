'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/types';

const GESTION: Role[] = ['ADMIN', 'SECRETARIAT'];

export type LienMenu = { href: string; libelle: string; icone: string };

/** `roles` absent : tout le personnel. */
const LIENS: (LienMenu & { roles?: Role[] })[] = [
  { href: '/eleves', libelle: 'Élèves', icone: '🎒' },
  { href: '/tuteurs', libelle: 'Tuteurs', icone: '👪' },
  { href: '/classes', libelle: 'Classes', icone: '🏫' },
  { href: '/absences', libelle: 'Absences', icone: '📋' },
  { href: '/comportements', libelle: 'Comportement', icone: '⭐' },
  {
    href: '/resultats',
    libelle: 'Résultats',
    icone: '📊',
    roles: [...GESTION, 'ENSEIGNANT'],
  },
  {
    href: '/paiements',
    libelle: 'Paiements',
    icone: '💰',
    roles: [...GESTION, 'COMPTABLE'],
  },
  { href: '/annonces', libelle: 'Annonces', icone: '📢', roles: GESTION },
  { href: '/evenements', libelle: 'Événements', icone: '📅' },
  { href: '/appareils', libelle: 'Appareils', icone: '📱' },
  {
    href: '/notifications',
    libelle: 'Notifications',
    icone: '🔔',
    roles: GESTION,
  },
  { href: '/personnel', libelle: 'Personnel', icone: '🧑‍🏫', roles: ['ADMIN'] },
  { href: '/journal', libelle: 'Journal', icone: '🗂️', roles: ['ADMIN'] },
  { href: '/abonnement', libelle: 'Abonnement', icone: '💳', roles: ['ADMIN'] },
];

/** Menu du personnel de l'école, selon son rôle. */
export function Navigation({ role }: { role: Role }) {
  return (
    <Menu
      liens={LIENS.filter((l) => !l.roles || l.roles.includes(role))}
      libelle="Navigation principale"
    />
  );
}

const pastille =
  'inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition active:scale-[0.97]';
const pastilleActive = `${pastille} fond-degrade border-transparent text-white shadow-md shadow-marque-700/30`;
const pastilleInactive = `${pastille} contour-degrade text-marque-800 shadow-sm hover:-translate-y-px hover:shadow-md hover:shadow-marque-700/15`;

/**
 * Barre de menu sous le bandeau : pastilles à contour dégradé sur grand écran,
 * bouton « Menu » qui déplie les rubriques sur téléphone.
 */
export function Menu({
  liens,
  libelle,
  largeur = 'max-w-6xl',
}: {
  liens: LienMenu[];
  libelle: string;
  largeur?: string;
}) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  // Rubrique active : le lien le plus long qui contient la page affichée.
  const actif = liens
    .filter((l) => chemin === l.href || chemin.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const lien = (l: LienMenu) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOuvert(false)}
      aria-current={l === actif ? 'page' : undefined}
      className={l === actif ? pastilleActive : pastilleInactive}
    >
      <span aria-hidden>{l.icone}</span>
      {l.libelle}
    </Link>
  );

  return (
    <nav
      aria-label={libelle}
      className="sticky top-0 z-30 border-b border-marque-100 bg-white/90 shadow-sm backdrop-blur"
    >
      <div className={`mx-auto ${largeur} px-4 py-2.5`}>
        <div className="hidden flex-wrap gap-2 md:flex">{liens.map(lien)}</div>
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setOuvert(!ouvert)}
            aria-expanded={ouvert}
            className="contour-degrade flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 text-left font-semibold text-marque-900 shadow-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden>{actif?.icone ?? '☰'}</span>
              <span className="truncate">{actif?.libelle ?? 'Menu'}</span>
            </span>
            <span className="flex items-center gap-2 text-sm text-marque-700">
              Menu
              <svg
                viewBox="0 0 20 20"
                className={`h-4 w-4 transition-transform ${ouvert ? 'rotate-180' : ''}`}
                fill="currentColor"
                aria-hidden
              >
                <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06z" />
              </svg>
            </span>
          </button>
          {ouvert && (
            <div className="grid grid-cols-2 gap-2 pt-3 pb-1 [&>a]:justify-start [&>a]:whitespace-normal">
              {liens.map(lien)}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
