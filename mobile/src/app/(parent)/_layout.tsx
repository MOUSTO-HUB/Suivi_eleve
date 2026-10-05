import { Stack } from 'expo-router';
import { Consentement } from '@/components/consentement';
import { couleurs } from '@/components/ui';
import { FournisseurEnfants } from '@/lib/enfants';
import { useOuvertureDepuisPush } from '@/lib/push';
import { useUtilisateur } from '@/lib/session';

export default function EspaceParent() {
  useOuvertureDepuisPush();
  const u = useUtilisateur();
  // Rien n'est affiché avant l'accord du tuteur sur l'usage de ses données.
  if (u.consentement && !u.consentement.accepte) return <Consentement />;
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
