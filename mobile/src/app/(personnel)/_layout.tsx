import { Stack } from 'expo-router';
import { couleurs } from '@/components/ui';

export const unstable_settings = { initialRouteName: 'personnel' };

/** Mode PERSONNEL : enseignants, surveillants et administration. */
export default function EspacePersonnel() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: couleurs.primaire,
        headerTitleStyle: { color: couleurs.texte },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="personnel" options={{ title: 'Suivi_eleve' }} />
      <Stack.Screen
        name="scanner"
        options={{ title: 'Scanner une étiquette' }}
      />
      <Stack.Screen name="appareil/[code]" options={{ title: 'Appareil' }} />
      <Stack.Screen
        name="signaler-comportement"
        options={{ title: 'Signaler un comportement' }}
      />
    </Stack>
  );
}
