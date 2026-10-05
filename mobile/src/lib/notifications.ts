import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ErreurApi, lire } from './api';
import { mettreEnCache, notificationsEnCache } from './stockage-local';
import type { MesNotifications, Notification } from './types';

/**
 * Dernières notifications du parent. Sans réseau, les 50 dernières restent
 * consultables grâce au cache du téléphone (`horsLigne` vaut alors vrai).
 */
export function useMesNotifications() {
  const [liste, setListe] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [horsLigne, setHorsLigne] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    setChargement(true);
    try {
      const page = await lire<MesNotifications>(
        '/notifications/mes?parPage=50',
      );
      const cache = await mettreEnCache(page.elements);
      // Le serveur fait foi : une notification lue ailleurs l'est aussi ici.
      setListe(cache.map((n) => page.elements.find((p) => p.id === n.id) ?? n));
      setNonLues(page.nonLues);
      setHorsLigne(false);
      setErreur(null);
    } catch (e) {
      const cache = await notificationsEnCache();
      setListe(cache);
      setNonLues(cache.filter((n) => !n.lueLe).length);
      setHorsLigne(true);
      if (!cache.length)
        setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
    } finally {
      setChargement(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void recharger();
    }, [recharger]),
  );

  return { liste, nonLues, chargement, horsLigne, erreur, recharger };
}
