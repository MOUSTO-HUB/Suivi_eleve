import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  Bouton,
  Carte,
  Ecran,
  Etat,
  Message,
  Pastille,
  Texte,
  Titre,
} from '@/components/ui';
import { envoyer } from '@/lib/api';
import {
  dateFr,
  heureFr,
  lienNotification,
  TYPES_NOTIFICATION,
} from '@/lib/format';
import { marquerLueEnCache, notificationsEnCache } from '@/lib/stockage-local';
import type { Notification } from '@/lib/types';

/**
 * Détail d'un message, lu depuis le cache du téléphone (donc aussi hors ligne).
 * L'ouverture vaut accusé de lecture : l'école voit que la famille a lu.
 */
export default function DetailNotification() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [n, setN] = useState<Notification | null | undefined>(undefined);
  const [accuse, setAccuse] = useState<'envoye' | 'en-attente' | null>(null);

  useEffect(() => {
    void notificationsEnCache().then((liste) => {
      const trouvee = liste.find((x) => x.id === id) ?? null;
      setN(trouvee);
      if (trouvee && !trouvee.lueLe) {
        envoyer(`/notifications/${id}/lue`, 'POST')
          .then(() => marquerLueEnCache(id))
          .then(() => setAccuse('envoye'))
          .catch(() => setAccuse('en-attente'));
      }
    });
  }, [id]);

  if (n === undefined) return <Etat chargement erreur={null} />;
  if (n === null)
    return (
      <Ecran>
        <Etat
          chargement={false}
          erreur="Ce message n'est plus disponible sur le téléphone."
        />
      </Ecran>
    );

  const type = TYPES_NOTIFICATION[n.type];
  const lien = lienNotification(n);
  return (
    <Ecran>
      <Stack.Screen options={{ title: type.libelle }} />
      <Text style={{ fontSize: 40 }}>{type.icone}</Text>
      {n.priorite === 'URGENTE' && <Pastille ton="danger">Urgent</Pastille>}
      <Titre>{n.sujet || type.libelle}</Titre>
      <Texte discret>
        Reçu le {dateFr(n.creeLe)} à {heureFr(n.creeLe)}
        {n.eleve ? ` · ${n.eleve.prenoms}` : ''}
      </Texte>
      <Carte>
        <Texte>{n.contenu}</Texte>
      </Carte>
      {accuse === 'en-attente' && (
        <Message type="info">
          Pas de réseau : l&apos;école saura que vous avez lu ce message quand
          vous le rouvrirez avec une connexion.
        </Message>
      )}
      {lien && (
        <Bouton
          libelle={
            n.type === 'EVENEMENT'
              ? "Voir l'événement et répondre"
              : 'Voir le détail'
          }
          surAppui={() => router.push(lien as never)}
        />
      )}
    </Ecran>
  );
}
