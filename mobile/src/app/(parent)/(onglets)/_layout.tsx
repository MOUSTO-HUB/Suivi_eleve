import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { couleurs } from '@/components/ui';

const icone = (symbole: string) =>
  function Icone({ focused }: { focused: boolean }) {
    return (
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>
        {symbole}
      </Text>
    );
  };

export default function Onglets() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: couleurs.primaire,
        tabBarLabelStyle: { fontSize: 13 },
        tabBarStyle: { minHeight: 64 },
        headerTitleStyle: { color: couleurs.texte },
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
