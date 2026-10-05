// Règles des comptes du personnel, sans accès à la base (testées).
import { randomInt } from 'node:crypto';

export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

/** Erreur lisible si le mot de passe est trop faible, sinon null. */
export function erreurMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE)
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  if (!/[A-Za-zÀ-ÿ]/.test(motDePasse) || !/\d/.test(motDePasse))
    return 'Le mot de passe doit contenir des lettres et des chiffres.';
  return null;
}

// Sans caractères ambigus (0/O, 1/l/I) : il est dicté ou recopié à la main.
const LETTRES = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const CHIFFRES = '23456789';

/** Mot de passe provisoire, ex. « Kp7m-x3Qa-9tRw » (à changer à la première connexion). */
export function motDePasseProvisoire(): string {
  const groupe = () =>
    Array.from({ length: 4 }, (_, i) => {
      const source = i === 2 ? CHIFFRES : LETTRES + CHIFFRES;
      return source[randomInt(source.length)];
    }).join('');
  return `${groupe()}-${groupe()}-${groupe()}`;
}
