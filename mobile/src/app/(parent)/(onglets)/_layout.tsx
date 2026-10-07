import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useOptionsEntete } from '@/components/entete';
import { useTheme } from '@/lib/theme';

const icone = (symbole: string) =>
  function Icone({ focused }: { focused: boolean }) {
    return (
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>
        {symbole}
      </Text>
    );
  };

export default function Onglets() {
  const entete = useOptionsEntete();
  const { couleurs } = useTheme();
  return (
    <Tabs
      screenOptions={{
        ...entete,
        sceneStyle: { backgroundColor: couleurs.fond },
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.secondaire,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarStyle: {
          minHeight: 64,
          backgroundColor: couleurs.carte,
          borderTopColor: couleurs.bordure,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: icone('🏠') }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: 'Messages', tabBarIcon: icone('✉️') }}
      />
      <Tabs.Screen
        name="evenements"
        options={{ title: 'Événements', tabBarIcon: icone('📅') }}
      />
      <Tabs.Screen
        name="reglages"
        options={{ title: 'Réglages', tabBarIcon: icone('⚙️') }}
      />
    </Tabs>
  );
}
