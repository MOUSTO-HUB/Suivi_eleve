import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ErreurApi, lire } from './api';

export interface Requete<T> {
  donnees: T | null;
  erreur: string | null;
  chargement: boolean;
  recharger: () => Promise<void>;
}

/** Lit une ressource de l'API à chaque affichage de l'écran (null : rien à lire). */
export function useRequete<T>(chemin: string | null): Requete<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(chemin !== null);
  // Numéro de la dernière demande : une réponse plus ancienne (ex. arrivée après
  // un changement d'enfant) est ignorée.
  const derniere = useRef(0);

  const recharger = useCallback(async () => {
    if (!chemin) return;
    const numero = ++derniere.current;
    setChargement(true);
    try {
      const resultat = await lire<T>(chemin);
      if (numero !== derniere.current) return;
      setDonnees(resultat);
      setErreur(null);
    } catch (e) {
      if (numero !== derniere.current) return;
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
    } finally {
      if (numero === derniere.current) setChargement(false);
    }
  }, [chemin]);

  useFocusEffect(
    useCallback(() => {
      void recharger();
    }, [recharger]),
  );

  return { donnees, erreur, chargement, recharger };
}
