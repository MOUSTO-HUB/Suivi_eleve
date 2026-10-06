'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/** Événement `beforeinstallprompt` (Chrome, Edge, Android) : pas encore dans les types du DOM. */
interface InvitationNavigateur extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Etat = 'installee' | 'masquee' | 'ios' | 'autre';

const CLE_MASQUEE = 'suivi-eleve:installation-masquee';

const sansAbonnement = () => () => {};

function etatAppareil(): Etat {
  const installee =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installee) return 'installee';
  try {
    if (localStorage.getItem(CLE_MASQUEE) === '1') return 'masquee';
  } catch {
    // Stockage indisponible (navigation privée) : l'invitation reste affichée.
  }
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'autre';
}

/** Enregistre le service worker (page hors ligne et installation de l'application). */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Sans service worker (HTTP hors localhost), le site reste utilisable normalement.
      });
  }, []);
  return null;
}

/**
 * Bandeau proposant d'installer le site comme une application :
 * bouton natif sur Chrome, Edge et Android, mode d'emploi sur iPhone et iPad.
 */
export function InvitationInstallation() {
  const etat = useSyncExternalStore<Etat | null>(
    sansAbonnement,
    etatAppareil,
    () => null,
  );
  const [invitation, setInvitation] = useState<InvitationNavigateur | null>(
    null,
  );
  const [fermee, setFermee] = useState(false);

  useEffect(() => {
    const surInvitation = (evenement: Event) => {
      evenement.preventDefault();
      setInvitation(evenement as InvitationNavigateur);
    };
    const surInstallation = () => setFermee(true);
    window.addEventListener('beforeinstallprompt', surInvitation);
    window.addEventListener('appinstalled', surInstallation);
    return () => {
      window.removeEventListener('beforeinstallprompt', surInvitation);
      window.removeEventListener('appinstalled', surInstallation);
    };
  }, []);

  if (fermee || !etat || etat === 'installee' || etat === 'masquee')
    return null;
  if (etat === 'autre' && !invitation) return null;

  const masquer = () => {
    try {
      localStorage.setItem(CLE_MASQUEE, '1');
    } catch {
      // Tant pis : le bandeau reviendra à la prochaine visite.
    }
    setFermee(true);
  };

  const installer = async () => {
    if (!invitation) return;
    await invitation.prompt();
    const { outcome } = await invitation.userChoice;
    setInvitation(null);
    if (outcome === 'accepted') setFermee(true);
  };

  return (
    <aside
      aria-label="Installer l'application"
      className="border-b border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <p className="flex-1">
          {etat === 'ios' ? (
            <>
              Ajoutez Suivi_eleve à votre écran d&apos;accueil : touchez{' '}
              <strong>Partager</strong>{' '}
              <span aria-hidden="true">(carré avec une flèche)</span>, puis{' '}
              <strong>Sur l&apos;écran d&apos;accueil</strong>.
            </>
          ) : (
            <>
              Installez Suivi_eleve sur cet appareil pour l&apos;ouvrir comme
              une application.
            </>
          )}
        </p>
        {invitation && etat !== 'ios' && (
          <button
            type="button"
            onClick={installer}
            className="rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800"
          >
            Installer
          </button>
        )}
        <button
          type="button"
          onClick={masquer}
          aria-label="Ne plus proposer l'installation"
          className="rounded-md px-2 py-1 text-lg leading-none text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
