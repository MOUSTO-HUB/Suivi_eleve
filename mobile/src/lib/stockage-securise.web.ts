// Navigateur (simulation pour les tests) : SecureStore n'existe pas sur le web.
// localStorage n'est pas chiffré : cette version ne sert qu'au développement,
// l'espace parents web de production est le site Next.js.
export async function lireSecret(cle: string): Promise<string | null> {
  return globalThis.localStorage?.getItem(cle) ?? null;
}

export async function ecrireSecret(cle: string, valeur: string): Promise<void> {
  globalThis.localStorage?.setItem(cle, valeur);
}

export async function effacerSecret(cle: string): Promise<void> {
  globalThis.localStorage?.removeItem(cle);
}
