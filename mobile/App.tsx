import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.titre}>Suivi_eleve</Text>
      <Text style={styles.texte}>
        Le suivi de la scolarité de votre enfant.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  titre: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  texte: {
    fontSize: 16,
    color: '#52525b',
    textAlign: 'center',
  },
});
