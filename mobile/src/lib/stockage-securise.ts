import * as SecureStore from 'expo-secure-store';

// Téléphone : trousseau chiffré (Keychain iOS, Keystore Android).
export const lireSecret = (cle: string) => SecureStore.getItemAsync(cle);
export const ecrireSecret = (cle: string, valeur: string) =>
  SecureStore.setItemAsync(cle, valeur);
export const effacerSecret = (cle: string) => SecureStore.deleteItemAsync(cle);
