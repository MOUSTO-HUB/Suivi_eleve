'use client';

import { useEffect, useRef, useState } from 'react';
import { Alerte, styles } from '@/components/ui';
import { suivreWhatsapp } from './actions';

const INTERVALLE_MS = 3000;

/**
 * Connexion par WhatsApp : le parent envoie le message prérempli au numéro du
 * service ; la page vérifie toutes les 3 secondes (et dès qu'il revient sur
 * l'onglet) si le message est arrivé, puis ouvre l'espace parent.
 */
export function AttenteWhatsappPanneau({
  code,
  lien,
  numero,
  telephone,
}: {
  code: string;
  lien: string;
  numero: string;
  telephone: string;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const enCours = useRef(false);

  useEffect(() => {
    if (erreur) return;
    const verifier = async () => {
      if (enCours.current) return;
      enCours.current = true;
      try {
        const resultat = await suivreWhatsapp();
        if (resultat?.erreur) setErreur(resultat.erreur);
      } finally {
        enCours.current = false;
      }
    };
    const minuterie = setInterval(() => void verifier(), INTERVALLE_MS);
    const auRetour = () => {
      if (document.visibilityState === 'visible') void verifier();
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [erreur]);

  if (erreur) return <Alerte>{erreur}</Alerte>;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-marque-50 p-3 text-sm text-marque-800">
        Pour vous connecter avec le numéro {telephone}, envoyez depuis{' '}
        <strong>votre WhatsApp</strong> le message proposé au {numero}.
      </p>
      <a
        href={lien}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.bouton} py-3 text-base`}
      >
        Ouvrir WhatsApp et envoyer le message
      </a>
      <p className="text-sm text-slate-600">
        Le message contient le code{' '}
        <strong className="font-mono text-base tracking-widest text-slate-900">
          {code}
        </strong>
        . Sur un ordinateur, vous pouvez aussi l&apos;envoyer depuis votre
        téléphone au {numero}. Le code est valable 10 minutes.
      </p>
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-pulse rounded-full bg-marque-500"
        />
        En attente de votre message… cette page s&apos;ouvrira toute seule.
      </p>
    </div>
  );
}
