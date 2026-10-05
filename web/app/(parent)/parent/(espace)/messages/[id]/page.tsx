import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TitreParent } from '@/components/parent';
import { Badge, Carte, styles } from '@/components/ui';
import { envoyerApi, lireApi } from '@/lib/api';
import {
  dateHeureFr,
  ICONES_NOTIFICATION,
  LIBELLES_TYPE_NOTIFICATION,
  lienMessage,
  type MesNotifications,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Message · Suivi_eleve' };

/** Détail d'un message ; l'ouverture vaut accusé de lecture (l'école le voit). */
export default async function Message(
  props: PageProps<'/parent/messages/[id]'>,
) {
  const { id } = await props.params;
  const messages = await lireApi<MesNotifications>(
    '/notifications/mes?parPage=100',
  );
  const n = messages.elements.find((m) => m.id === id);
  if (!n) notFound();
  if (!n.lueLe)
    await envoyerApi(`/notifications/${id}/lue`, 'POST').catch(() => undefined);
  const lien = lienMessage(n);

  return (
    <>
      <TitreParent
        titre={n.sujet || LIBELLES_TYPE_NOTIFICATION[n.type]}
        sousTitre={`${LIBELLES_TYPE_NOTIFICATION[n.type]}${n.eleve ? ` · ${n.eleve.prenoms}` : ''} · reçu le ${dateHeureFr(n.creeLe)}`}
        retour="/parent/messages"
      />
      {n.priorite === 'URGENTE' && (
        <div className="mb-3">
          <Badge couleur="orange">Urgent</Badge>
        </div>
      )}
      <Carte>
        <div className="flex gap-4">
          <span className="text-4xl" aria-hidden>
            {ICONES_NOTIFICATION[n.type]}
          </span>
          <p className="whitespace-pre-line text-base leading-relaxed">
            {n.contenu}
          </p>
        </div>
      </Carte>
      {lien && (
        <div className="mt-4">
          <Link href={lien} className={styles.bouton}>
            {n.type === 'EVENEMENT'
              ? "Voir l'événement et répondre"
              : 'Voir le détail'}
          </Link>
        </div>
      )}
    </>
  );
}
