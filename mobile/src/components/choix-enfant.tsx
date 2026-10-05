import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useEnfants } from '@/lib/enfants';
import { couleurs } from './ui';

/** Boutons pour passer d'un enfant à l'autre ; rien si le parent n'en a qu'un. */
export function ChoixEnfant() {
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
            style={[styles.puce, actif && styles.puceActive]}
          >
            <Text style={[styles.nom, actif && { color: couleurs.blanc }]}>
              {e.prenoms}
            </Text>
            {e.classe && (
              <Text
                style={[
                  styles.classe,
                  actif && { color: couleurs.primaireClair },
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

const styles = StyleSheet.create({
  rangee: { gap: 8, paddingVertical: 2 },
  puce: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: couleurs.blanc,
    justifyContent: 'center',
  },
  puceActive: {
    backgroundColor: couleurs.primaire,
    borderColor: couleurs.primaire,
  },
  nom: { fontSize: 17, fontWeight: '600', color: couleurs.texte },
  classe: { fontSize: 13, color: couleurs.secondaire },
});
