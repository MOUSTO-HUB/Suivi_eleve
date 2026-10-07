import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { degrade, useTheme } from '@/lib/theme';
import { ChoixTheme } from './ui';

/** En-tête des écrans : bandeau en dégradé bleu, titre blanc, bouton ☀️/🌙. */
export function useOptionsEntete() {
  const { couleurs } = useTheme();
  return {
    headerBackground: () => (
      <View style={[StyleSheet.absoluteFill, degrade(couleurs.bandeau, 110)]} />
    ),
    headerTintColor: couleurs.surPrimaire,
    headerTitleStyle: {
      color: couleurs.surPrimaire,
      fontWeight: '700' as const,
    },
    headerShadowVisible: false,
    // Le navigateur ne laisse aucune marge à droite de l'en-tête.
    headerRight: () => (
      <View style={{ marginRight: Platform.OS === 'web' ? 12 : 0 }}>
        <ChoixTheme surFond />
      </View>
    ),
  };
}

/** Haut des écrans de connexion : dégradé, logo, phrase d'accueil, bouton ☀️/🌙. */
export function Accueil({ sousTitre }: { sousTitre: string }) {
  const { couleurs } = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={[
        degrade(couleurs.bandeau, 110),
        styles.accueil,
        { paddingTop: top + 16 },
      ]}
    >
      <View style={styles.theme}>
        <ChoixTheme surFond />
      </View>
      <View style={[styles.logo, degrade(couleurs.degrade)]}>
        <Text style={{ fontSize: 34 }}>🎓</Text>
      </View>
      <Text style={styles.nom}>Suivi_eleve</Text>
      <Text style={styles.sousTitre}>{sousTitre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  accueil: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  theme: { alignSelf: 'flex-end' },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  nom: { fontSize: 32, fontWeight: '800', color: '#ffffff' },
  sousTitre: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
});
