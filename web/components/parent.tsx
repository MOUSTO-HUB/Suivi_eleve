import Link from 'next/link';
import type { ReactNode } from 'react';
import { lireApi } from '@/lib/api';
import {
  dateHeureFr,
  ICONES_NOTIFICATION,
  LIBELLES_TYPE_NOTIFICATION,
  type Eleve,
  type NotificationParent,
  type Page,
} from '@/lib/types';

/** Enfants du parent connecté (l'API ne renvoie que les siens). */
export async function mesEnfants(): Promise<Eleve[]> {
  return (await lireApi<Page<Eleve>>('/eleves?parPage=20')).elements;
}

/** Enfant choisi par ?enfant=… (le premier par défaut). */
export async function enfantChoisi(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
) {
  const [enfants, params] = await Promise.all([mesEnfants(), searchParams]);
  const demande = [params.enfant].flat()[0];
  return {
    enfants,
    enfant: enfants.find((e) => e.id === demande) ?? enfants[0] ?? null,
  };
}

/** Boutons pour passer d'un enfant à l'autre ; rien s'il n'y en a qu'un. */
export function ChoixEnfant({
  enfants,
  actif,
  chemin,
}: {
  enfants: Eleve[];
  actif: string | undefined;
  chemin: string;
}) {
  if (enfants.length < 2) return null;
  return (
    <nav aria-label="Choix de l'enfant" className="mb-4 flex flex-wrap gap-2">
      {enfants.map((e) => (
        <Link
          key={e.id}
          href={`${chemin}?enfant=${e.id}`}
          aria-current={e.id === actif ? 'true' : undefined}
          className={`rounded-full border px-4 py-2 text-base font-medium ${
            e.id === actif
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
          }`}
        >
          {e.prenoms}
          {e.classe && (
            <span className="ml-1 text-sm opacity-75">({e.classe.nom})</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Titre de page avec retour à l'accueil de l'espace parents. */
export function TitreParent({
  titre,
  sousTitre,
  retour = '/parent',
}: {
  titre: string;
  sousTitre?: ReactNode;
  retour?: string;
}) {
  return (
    <div className="mb-4">
      <Link
        href={retour}
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Retour
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {titre}
      </h1>
      {sousTitre && (
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{sousTitre}</p>
      )}
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}

/** Un message de l'école : icône du type, enfant, date ; bord vert si non lu. */
export function LigneMessage({ n }: { n: NotificationParent }) {
  return (
    <Link
      href={`/parent/messages/${n.id}`}
      className={`flex gap-3 rounded-xl border bg-white p-4 hover:border-emerald-600 dark:bg-zinc-900 ${
        n.priorite === 'URGENTE'
          ? 'border-l-4 border-red-600'
          : n.lueLe
            ? 'border-zinc-200 dark:border-zinc-800'
            : 'border-l-4 border-emerald-700'
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {ICONES_NOTIFICATION[n.type]}
      </span>
      <span className="flex flex-col">
        <span className="text-sm text-zinc-500">
          {LIBELLES_TYPE_NOTIFICATION[n.type]}
          {n.eleve ? ` · ${n.eleve.prenoms}` : ''}
        </span>
        <span className={n.lueLe ? '' : 'font-semibold'}>
          {n.sujet || n.contenu.slice(0, 80)}
        </span>
        <span className="text-sm text-zinc-500">
          {dateHeureFr(n.creeLe)}
          {n.lueLe ? '' : ' · non lu'}
        </span>
      </span>
    </Link>
  );
}
