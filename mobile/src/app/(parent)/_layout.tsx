import { Stack } from 'expo-router';
import { couleurs } from '@/components/ui';
import { FournisseurEnfants } from '@/lib/enfants';
import { useOuvertureDepuisPush } from '@/lib/push';

export default function EspaceParent() {
  useOuvertureDepuisPush();
  return (
    <FournisseurEnfants>
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
