import { Stack } from 'expo-router';
import { useOptionsEntete } from '@/components/entete';
import { useTheme } from '@/lib/theme';

export const unstable_settings = { initialRouteName: 'personnel' };

/** Mode PERSONNEL : enseignants, surveillants et administration. */
export default function EspacePersonnel() {
  const entete = useOptionsEntete();
  const { couleurs } = useTheme();
  return (
    <Stack
      screenOptions={{
        ...entete,
        contentStyle: { backgroundColor: couleurs.fond },
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
