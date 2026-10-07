import { Stack } from 'expo-router';
import { Consentement } from '@/components/consentement';
import { useOptionsEntete } from '@/components/entete';
import { FournisseurEnfants } from '@/lib/enfants';
import { useOuvertureDepuisPush } from '@/lib/push';
import { useUtilisateur } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function EspaceParent() {
  useOuvertureDepuisPush();
  const u = useUtilisateur();
  const entete = useOptionsEntete();
  const { couleurs } = useTheme();
  // Rien n'est affiché avant l'accord du tuteur sur l'usage de ses données.
  if (u.consentement && !u.consentement.accepte) return <Consentement />;
  return (
    <FournisseurEnfants>
      <Stack
        screenOptions={{
          ...entete,
          contentStyle: { backgroundColor: couleurs.fond },
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
