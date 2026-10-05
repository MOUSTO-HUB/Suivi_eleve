import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { envoyer } from './api';

// Notifications reçues application ouverte : bannière et liste, sans son.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let jetonEnregistre: string | null = null;

/**
 * Enregistre le jeton push natif (FCM sur Android) auprès de l'API.
 * Sans effet dans Expo Go et sur simulateur, où le push distant n'existe pas.
 */
export async function inscrirePush(): Promise<void> {
  try {
    if (!Device.isDevice || Constants.executionEnvironment === 'storeClient')
      return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages de l’école',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const permission = await Notifications.getPermissionsAsync();
    const accordee =
      permission.granted ||
      (await Notifications.requestPermissionsAsync()).granted;
    if (!accordee) return;
    const { data } = await Notifications.getDevicePushTokenAsync();
    const jeton = String(data);
    await envoyer('/notifications/jetons-push', 'POST', {
      jeton,
      plateforme: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    jetonEnregistre = jeton;
  } catch {
    // Le parent reçoit toujours SMS et email : le push est un complément.
  }
}

/** Notification push touchée : ouvre la liste des messages. */
export function useOuvertureDepuisPush() {
  const reponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!reponse) return;
    router.navigate('/notifications');
    void Notifications.clearLastNotificationResponseAsync();
  }, [reponse]);
}

export async function desinscrirePush(): Promise<void> {
  if (!jetonEnregistre) return;
  await envoyer('/notifications/jetons-push', 'DELETE', {
    jeton: jetonEnregistre,
  }).catch(() => undefined);
  jetonEnregistre = null;
}
