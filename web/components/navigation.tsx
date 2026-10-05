'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/types';

const GESTION: Role[] = ['ADMIN', 'SECRETARIAT'];

/** `roles` absent : tout le personnel. */
const LIENS: { href: string; libelle: string; roles?: Role[] }[] = [
  { href: '/eleves', libelle: 'Élèves' },
  { href: '/tuteurs', libelle: 'Tuteurs' },
  { href: '/classes', libelle: 'Classes' },
  { href: '/absences', libelle: 'Absences' },
  { href: '/comportements', libelle: 'Comportement' },
  {
    href: '/resultats',
    libelle: 'Résultats',
    roles: [...GESTION, 'ENSEIGNANT'],
  },
  {
    href: '/paiements',
    libelle: 'Paiements',
    roles: [...GESTION, 'COMPTABLE'],
  },
  { href: '/annonces', libelle: 'Annonces', roles: GESTION },
  { href: '/appareils', libelle: 'Appareils' },
  { href: '/notifications', libelle: 'Notifications', roles: GESTION },
];

export function Navigation({ role }: { role: Role }) {
  const chemin = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-wrap gap-1">
      {LIENS.filter((l) => !l.roles || l.roles.includes(role)).map(
        ({ href, libelle }) => {
          const actif = chemin === href || chemin.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                actif
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
            >
              {libelle}
            </Link>
          );
        },
      )}
    </nav>
  );
}
