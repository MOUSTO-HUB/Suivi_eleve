'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Recharge les données de la page à intervalle régulier (suivi en temps réel). */
export function RafraichissementAuto({
  actif,
  secondes = 5,
}: {
  actif: boolean;
  secondes?: number;
}) {
  const routeur = useRouter();
  useEffect(() => {
    if (!actif) return;
    const minuteur = setInterval(() => routeur.refresh(), secondes * 1000);
    return () => clearInterval(minuteur);
  }, [actif, secondes, routeur]);
  return actif ? (
    <span className="text-xs text-zinc-500" aria-live="polite">
      Mise à jour automatique toutes les {secondes} s
    </span>
  ) : null;
}
