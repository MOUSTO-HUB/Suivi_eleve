import AsyncStorage from '@react-native-async-storage/async-storage';
import { fusionnerNotifications } from './format';
import type { Notification } from './types';

// Données gardées sur le téléphone : consultables sans réseau (3G instable).
const CLE_NOTIFICATIONS = 'suivi.notifications';
const CLE_ENFANT = 'suivi.enfantActif';

let memoire: Notification[] | null = null;

export async function notificationsEnCache(): Promise<Notification[]> {
  if (memoire) return memoire;
  try {
    const brut = await AsyncStorage.getItem(CLE_NOTIFICATIONS);
    memoire = brut ? (JSON.parse(brut) as Notification[]) : [];
  } catch {
    memoire = [];
  }
  return memoire;
}

/** Ajoute les notifications reçues ; ne garde que les 50 plus récentes. */
export async function mettreEnCache(
  nouvelles: Notification[],
): Promise<Notification[]> {
  memoire = fusionnerNotifications(nouvelles, await notificationsEnCache());
  await AsyncStorage.setItem(CLE_NOTIFICATIONS, JSON.stringify(memoire)).catch(
    () => undefined,
  );
  return memoire;
}

export async function marquerLueEnCache(id: string) {
  const liste = await notificationsEnCache();
  const lue = new Date().toISOString();
  await mettreEnCache(
    liste
      .filter((n) => n.id === id)
      .map((n) => ({ ...n, lueLe: n.lueLe ?? lue })),
  );
}

export async function enfantActifEnregistre(): Promise<string | null> {
  return AsyncStorage.getItem(CLE_ENFANT).catch(() => null);
}

export async function enregistrerEnfantActif(id: string) {
  await AsyncStorage.setItem(CLE_ENFANT, id).catch(() => undefined);
}

/** À la déconnexion : rien ne reste du compte précédent sur le téléphone. */
export async function viderCache() {
  memoire = null;
  await AsyncStorage.multiRemove([CLE_NOTIFICATIONS, CLE_ENFANT]).catch(
    () => undefined,
  );
}
