'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LIENS = [
  { href: '/eleves', libelle: 'Élèves' },
  { href: '/tuteurs', libelle: 'Tuteurs' },
  { href: '/classes', libelle: 'Classes' },
];

export function Navigation() {
  const chemin = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex gap-1">
      {LIENS.map(({ href, libelle }) => {
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
      })}
    </nav>
  );
}
