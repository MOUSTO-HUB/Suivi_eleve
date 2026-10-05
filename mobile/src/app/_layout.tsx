import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { couleurs } from '@/components/ui';
import { FournisseurSession, useSession } from '@/lib/session';

/** Chaque espace n'est accessible qu'au bon profil ; sinon retour à la connexion. */
function Navigation() {
  const { chargement, utilisateur } = useSession();
  if (chargement) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={couleurs.primaire} />
      </View>
    );
  }
  const parent = utilisateur?.role === 'PARENT';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!utilisateur}>
        <Stack.Screen name="connexion" />
        <Stack.Screen name="connexion-personnel" />
      </Stack.Protected>
      <Stack.Protected guard={parent}>
        <Stack.Screen name="(parent)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(utilisateur) && !parent}>
        <Stack.Screen name="(personnel)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Racine() {
  return (
    <SafeAreaProvider>
      <FournisseurSession>
        <StatusBar style="dark" />
        <Navigation />
      </FournisseurSession>
    </SafeAreaProvider>
  );
}
