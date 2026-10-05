import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { couleurs } from '@/components/ui';
import { FournisseurEnfants } from '@/lib/enfants';

/** Notification push touchée : ouvre la liste des messages. */
function OuvertureDepuisPush() {
  const reponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!reponse) return;
    router.navigate('/notifications');
    void Notifications.clearLastNotificationResponseAsync();
  }, [reponse]);
  return null;
}

export default function EspaceParent() {
  return (
    <FournisseurEnfants>
      <OuvertureDepuisPush />
      <Stack
        screenOptions={{
          headerTintColor: couleurs.primaire,
          headerTitleStyle: { color: couleurs.texte },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
        <Stack.Screen name="notification/[id]" options={{ title: 'Message' }} />
        <Stack.Screen name="evenement/[id]" options={{ title: 'Événement' }} />
        <Stack.Screen name="resultats" options={{ title: 'Résultats' }} />
        <Stack.Screen name="comportement" options={{ title: 'Comportement' }} />
        <Stack.Screen name="paiements" options={{ title: 'Paiements' }} />
        <Stack.Screen name="absences" options={{ title: 'Absences' }} />
        <Stack.Screen name="appareils" options={{ title: 'Appareils' }} />
        <Stack.Screen
          name="preferences"
          options={{ title: 'Préférences des messages' }}
        />
      </Stack>
    </FournisseurEnfants>
  );
}
