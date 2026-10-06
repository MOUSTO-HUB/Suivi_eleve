'use client';

import { useEffect, useState } from 'react';
import {
  abonnerNotifications,
  desabonnerNotifications,
} from '@/app/(parent)/parent/actions';
import { styles } from '@/components/ui';

type Etat =
  | 'chargement'
  | 'incompatible'
  | 'iphone-a-installer'
  | 'bloque'
  | 'inactif'
  | 'actif';

/** Clé VAPID (base64url) au format attendu par le navigateur. */
function cleVersOctets(cle: string): Uint8Array<ArrayBuffer> {
  const base64 = (cle + '='.repeat((4 - (cle.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function versServeur(abonnement: PushSubscription) {
  const { endpoint, keys } = abonnement.toJSON();
  return {
    endpoint: endpoint ?? abonnement.endpoint,
    p256dh: keys?.p256dh ?? '',
    auth: keys?.auth ?? '',
  };
}

function etatInitial(): Promise<Etat> {
  const compatible =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  if (!compatible) {
    // Sur iPhone, les notifications n'existent que pour le site ajouté à l'écran d'accueil.
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return Promise.resolve(ios ? 'iphone-a-installer' : 'incompatible');
  }
  if (Notification.permission === 'denied') return Promise.resolve('bloque');
  return navigator.serviceWorker.ready
    .then((r) => r.pushManager.getSubscription())
    .then(async (abonnement) => {
      if (!abonnement) return 'inactif';
      // Renvoyé à chaque visite : le serveur peut l'avoir oublié, ou un autre parent
      // s'est connecté sur ce navigateur.
      await abonnerNotifications(versServeur(abonnement));
      return 'actif';
    });
}

/** Active ou coupe les notifications du site sur cet appareil (PC, Android, iPhone). */
export function NotificationsAppareil({
  clePublique,
}: {
  clePublique: string;
}) {
  const [etat, setEtat] = useState<Etat>('chargement');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    etatInitial()
      .then((e) => actif && setEtat(e))
      .catch(() => actif && setEtat('inactif'));
    return () => {
      actif = false;
    };
  }, []);

  const activer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      // Demandé au clic : obligatoire sur iPhone et recommandé partout.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'bloque' : 'inactif');
        return;
      }
      const enregistrement = await navigator.serviceWorker.ready;
      // Un ancien abonnement (autre clé serveur) empêcherait d'en créer un nouveau.
      await (await enregistrement.pushManager.getSubscription())?.unsubscribe();
      const abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleVersOctets(clePublique),
      });
      const resultat = await abonnerNotifications(versServeur(abonnement));
      if (resultat?.erreur) {
        await abonnement.unsubscribe();
        setErreur(resultat.erreur);
        return;
      }
      setEtat('actif');
    } catch {
      setErreur(
        "Impossible d'activer les notifications sur ce navigateur. Réessayez plus tard.",
      );
    } finally {
      setEnCours(false);
    }
  };

  const desactiver = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.getSubscription();
      if (abonnement) {
        await desabonnerNotifications(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setEtat('inactif');
    } catch {
      setErreur('Impossible de couper les notifications. Réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  if (etat === 'chargement') return null;

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Notifications sur cet appareil</h2>
      {etat === 'iphone-a-installer' && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sur iPhone et iPad, ajoutez d&apos;abord Suivi_eleve à l&apos;écran
          d&apos;accueil (<strong>Partager</strong> puis{' '}
          <strong>Sur l&apos;écran d&apos;accueil</strong>), ouvrez-le depuis
          cette icône, puis revenez sur cette page.
        </p>
      )}
      {etat === 'incompatible' && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ce navigateur ne permet pas de recevoir les notifications. Vous
          recevez toujours les SMS et les messages de l&apos;école ici.
        </p>
      )}
      {etat === 'bloque' && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Les notifications sont bloquées pour ce site. Autorisez-les dans les
          réglages du navigateur (icône à gauche de l&apos;adresse), puis
          rechargez la page.
        </p>
      )}
      {etat === 'inactif' && (
        <>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Recevez une alerte dès que l&apos;école envoie un message, même
            quand Suivi_eleve est fermé.
          </p>
          <button
            type="button"
            onClick={activer}
            disabled={enCours}
            className={`${styles.bouton} mt-3`}
          >
            {enCours ? 'Activation…' : 'Activer les notifications'}
          </button>
        </>
      )}
      {etat === 'actif' && (
        <>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            Activées : cet appareil reçoit les messages de l&apos;école.
          </p>
          <button
            type="button"
            onClick={desactiver}
            disabled={enCours}
            className={`${styles.boutonSecondaire} mt-3`}
          >
            {enCours ? 'Désactivation…' : 'Désactiver sur cet appareil'}
          </button>
        </>
      )}
      {erreur && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {erreur}
        </p>
      )}
    </div>
  );
}

/**
 * Sur la page de connexion (personne n'est connecté) : coupe l'abonnement laissé
 * par le parent précédent, pour qu'un navigateur partagé ne reçoive plus ses messages.
 */
export function DesabonnementDeconnexion() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((abonnement) => abonnement?.unsubscribe())
      .catch(() => undefined);
  }, []);
  return null;
}
