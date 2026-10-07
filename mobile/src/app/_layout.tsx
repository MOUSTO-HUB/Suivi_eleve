import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FournisseurSession, useSession } from '@/lib/session';
import { FournisseurTheme, useTheme } from '@/lib/theme';

/** Chaque espace n'est accessible qu'au bon profil ; sinon retour à la connexion. */
function Navigation() {
  const { chargement, utilisateur } = useSession();
  const { couleurs } = useTheme();
  if (chargement) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: couleurs.fond,
        }}
      >
        <ActivityIndicator size="large" color={couleurs.primaire} />
      </View>
    );
  }
  const parent = utilisateur?.role === 'PARENT';
  return (
    <>
      {/* Texte clair : chaque écran commence par un bandeau bleu. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: couleurs.fond },
        }}
      >
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
    </>
  );
}

export default function Racine() {
  return (
    <SafeAreaProvider>
      <FournisseurTheme>
        <FournisseurSession>
          <Navigation />
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>
  );
}
