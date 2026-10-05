import { LigneNotification } from '@/components/ligne-notification';
import { Ecran, Etat, Message, Texte } from '@/components/ui';
import { useMesNotifications } from '@/lib/notifications';

export default function Notifications() {
  const m = useMesNotifications();
  return (
    <Ecran enChargement={m.chargement} surRafraichir={m.recharger}>
      {m.horsLigne && m.liste.length > 0 && (
        <Message type="info">
          Pas de réseau : voici les 50 derniers messages enregistrés sur le
          téléphone.
        </Message>
      )}
      {m.nonLues > 0 && <Texte discret>{m.nonLues} message(s) non lu(s)</Texte>}
      <Etat
        chargement={m.chargement && !m.liste.length}
        erreur={m.erreur}
        vide={!m.liste.length && "Aucun message de l'école pour le moment."}
        surReessayer={m.recharger}
      />
      {m.liste.map((n) => (
        <LigneNotification key={n.id} n={n} />
      ))}
    </Ecran>
  );
}
