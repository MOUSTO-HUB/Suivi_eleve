// Chiffrement des secrets stockés en base (clé des applications d'authentification) :
// AES-256-GCM, clé dérivée de JWT_SECRET. Une copie de la base seule ne suffit pas à les lire.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const cle = (secret: string) =>
  createHash('sha256').update(`suivi-eleve:chiffrement:${secret}`).digest();

/** « iv.etiquette.donnees » en base64url. */
export function chiffrer(texte: string, secret: string): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv('aes-256-gcm', cle(secret), iv);
  const donnees = Buffer.concat([
    chiffreur.update(texte, 'utf8'),
    chiffreur.final(),
  ]);
  return [iv, chiffreur.getAuthTag(), donnees]
    .map((b) => b.toString('base64url'))
    .join('.');
}

export function dechiffrer(valeur: string, secret: string): string {
  const [iv, etiquette, donnees] = valeur
    .split('.')
    .map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !etiquette || !donnees)
    throw new Error('Valeur chiffrée invalide.');
  const dechiffreur = createDecipheriv('aes-256-gcm', cle(secret), iv);
  dechiffreur.setAuthTag(etiquette);
  return Buffer.concat([
    dechiffreur.update(donnees),
    dechiffreur.final(),
  ]).toString('utf8');
}
