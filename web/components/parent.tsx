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
          className={`rounded-full border-2 px-4 py-2 text-base font-semibold transition ${
            e.id === actif
              ? 'fond-degrade border-transparent text-white shadow-md shadow-marque-700/30'
              : 'contour-degrade text-marque-900 hover:shadow-md'
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
        className="text-sm font-medium text-marque-700 hover:underline"
      >
        ← Retour
      </Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-marque-950">
        {titre}
      </h1>
      {sousTitre && <p className="mt-1 text-slate-600">{sousTitre}</p>}
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
      {children}
    </p>
  );
}

/** Un message de l'école : icône du type, enfant, date ; bord vert si non lu. */
export function LigneMessage({ n }: { n: NotificationParent }) {
  return (
    <Link
      href={`/parent/messages/${n.id}`}
      className={`flex gap-3 rounded-2xl border bg-white p-4 shadow-sm shadow-marque-900/5 transition hover:border-marque-400 hover:shadow-md ${
        n.priorite === 'URGENTE'
          ? 'border-l-4 border-red-600'
          : n.lueLe
            ? 'border-marque-100'
            : 'border-l-4 border-l-marque-600 border-marque-100'
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {ICONES_NOTIFICATION[n.type]}
      </span>
      <span className="flex flex-col">
        <span className="text-sm text-slate-500">
          {LIBELLES_TYPE_NOTIFICATION[n.type]}
          {n.eleve ? ` · ${n.eleve.prenoms}` : ''}
        </span>
        <span className={n.lueLe ? '' : 'font-semibold'}>
          {n.sujet || n.contenu.slice(0, 80)}
        </span>
        <span className="text-sm text-slate-500">
          {dateHeureFr(n.creeLe)}
          {n.lueLe ? '' : ' · non lu'}
        </span>
      </span>
    </Link>
  );
}
