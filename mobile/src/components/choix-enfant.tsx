import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useEnfants } from '@/lib/enfants';
import { degrade, useStyles, useTheme, type Couleurs } from '@/lib/theme';

/** Boutons pour passer d'un enfant à l'autre ; rien si le parent n'en a qu'un. */
export function ChoixEnfant() {
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  const { enfants, enfant, choisir } = useEnfants();
  if (enfants.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rangee}
      accessibilityRole="tablist"
    >
      {enfants.map((e) => {
        const actif = e.id === enfant?.id;
        return (
          <Pressable
            key={e.id}
            onPress={() => choisir(e.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            style={[
              styles.puce,
              actif && [styles.puceActive, degrade(couleurs.degrade)],
            ]}
          >
            <Text
              style={[styles.nom, actif && { color: couleurs.surPrimaire }]}
            >
              {e.prenoms}
            </Text>
            {e.classe && (
              <Text
                style={[
                  styles.classe,
                  actif && { color: 'rgba(255,255,255,0.85)' },
                ]}
              >
                {e.classe.nom}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    rangee: { gap: 8, paddingVertical: 2 },
    puce: {
      minHeight: 52,
      paddingHorizontal: 18,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: couleurs.bordure,
      backgroundColor: couleurs.carte,
      justifyContent: 'center',
    },
    puceActive: {
      backgroundColor: couleurs.primaire,
      borderColor: 'transparent',
    },
    nom: { fontSize: 17, fontWeight: '600', color: couleurs.texte },
    classe: { fontSize: 13, color: couleurs.secondaire },
  });
