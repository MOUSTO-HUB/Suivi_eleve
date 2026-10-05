import type { Metadata } from 'next';
import Link from 'next/link';
import { LigneMessage, mesEnfants, Vide } from '@/components/parent';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import type { MesNotifications } from '@/lib/types';

export const metadata: Metadata = { title: 'Accueil · Suivi_eleve' };

const RUBRIQUES = [
  ['/parent/messages', 'Messages', '✉️'],
  ['/parent/evenements', 'Événements', '📅'],
  ['/parent/resultats', 'Résultats', '📊'],
  ['/parent/comportement', 'Comportement', '⭐'],
  ['/parent/absences', 'Absences', '📋'],
  ['/parent/paiements', 'Paiements', '💳'],
  ['/parent/appareils', 'Appareils', '📱'],
  ['/parent/preferences', 'Préférences', '⚙️'],
] as const;

export default async function AccueilParent() {
  const [profil, enfants, messages] = await Promise.all([
    profilCourant(),
    mesEnfants(),
    lireApi<MesNotifications>('/notifications/mes?parPage=5'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {profil.prenoms}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {enfants.length
            ? enfants
                .map(
                  (e) =>
                    `${e.prenoms} ${e.nom}${e.classe ? ` (${e.classe.nom})` : ''}`,
                )
                .join(' · ')
            : "Aucun enfant n'est rattaché à votre numéro : contactez le secrétariat de l'école."}
        </p>
      </div>

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RUBRIQUES.map(([href, libelle, icone]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white p-3 text-center font-medium text-zinc-900 shadow-sm hover:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <span className="text-3xl" aria-hidden>
              {icone}
            </span>
            {libelle}
            {href === '/parent/messages' && messages.nonLues > 0 && (
              <span className="rounded-full bg-emerald-700 px-2 text-xs text-white">
                {messages.nonLues} non lu(s)
              </span>
            )}
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Derniers messages</h2>
        {messages.elements.length === 0 ? (
          <Vide>Aucun message de l&apos;école pour le moment.</Vide>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.elements.map((n) => (
              <li key={n.id}>
                <LigneMessage n={n} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
