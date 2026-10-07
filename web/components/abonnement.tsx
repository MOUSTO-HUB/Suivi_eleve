import Link from 'next/link';
import { lireApi } from '@/lib/api';
import { dateFr, type MonAbonnement } from '@/lib/types';

/** Contact du fournisseur de Suivi_eleve pour renouveler (variable CONTACT_ABONNEMENT). */
export const contactAbonnement = () =>
  process.env.CONTACT_ABONNEMENT || 'le fournisseur de Suivi_eleve';

/**
 * Bandeau pour la direction : fin d'abonnement dans moins de 7 jours, ou
 * retard (avant la suspension). Rien sinon.
 */
export async function BandeauAbonnement() {
  // Simple information : en cas d'erreur, la page s'affiche sans bandeau.
  const a = await lireApi<MonAbonnement>('/abonnement').catch(() => null);
  if (!a || !['A_RENOUVELER', 'EN_RETARD'].includes(a.abonnement.etat))
    return null;
  const { joursRestants, finGrace, essai } = a.abonnement;
  const quoi = essai ? 'Votre essai gratuit' : 'Votre abonnement';
  const message =
    a.abonnement.etat === 'EN_RETARD'
      ? `${quoi} est terminé depuis le ${dateFr(a.finAbonnement)}. Sans renouvellement, l'accès à Suivi_eleve sera suspendu après le ${dateFr(finGrace)} pour tout le personnel et les familles.`
      : `${quoi} se termine ${joursRestants === 0 ? "aujourd'hui" : `le ${dateFr(a.finAbonnement)}`}. Pensez à le renouveler pour ne pas interrompre le service.`;
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 text-amber-900"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <p className="flex-1">{message}</p>
        <Link href="/abonnement" className="font-medium underline">
          Voir l&apos;abonnement
        </Link>
      </div>
    </div>
  );
}
