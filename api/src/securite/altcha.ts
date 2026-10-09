// « Je ne suis pas un robot » selon le protocole ALTCHA (https://altcha.org), sans service
// extérieur : le navigateur (ou l'application) cherche le nombre qui donne l'empreinte
// demandée. Quelques dixièmes de seconde pour une personne, coûteux pour un robot qui
// enchaîne des milliers d'essais. Règles pures (testées) ; AltchaService ajoute l'usage unique.
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export const DUREE_DEFI_S = 10 * 60;

export interface Defi {
  algorithm: 'SHA-256';
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

interface Solution {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

const sha256 = (texte: string) =>
  createHash('sha256').update(texte).digest('hex');
const hmac = (cle: string, texte: string) =>
  createHmac('sha256', cle).update(texte).digest('hex');

const egaux = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function creerDefi(
  cle: string,
  maxnumber: number,
  maintenant = Date.now(),
): Defi {
  const expire = Math.floor(maintenant / 1000) + DUREE_DEFI_S;
  const salt = `${randomBytes(12).toString('hex')}?expires=${expire}`;
  const challenge = sha256(`${salt}${randomInt(maxnumber + 1)}`);
  return {
    algorithm: 'SHA-256',
    challenge,
    maxnumber,
    salt,
    signature: hmac(cle, challenge),
  };
}

/**
 * Vérifie la réponse (base64 du JSON renvoyé par le widget). Renvoie sa
 * signature (pour refuser une deuxième utilisation) et son expiration, ou null.
 */
export function verifierSolution(
  charge: string,
  cle: string,
  maintenant = Date.now(),
): { signature: string; expireLe: number } | null {
  let s: Solution;
  try {
    s = JSON.parse(Buffer.from(charge, 'base64').toString('utf8')) as Solution;
  } catch {
    return null;
  }
  if (
    s?.algorithm !== 'SHA-256' ||
    typeof s.challenge !== 'string' ||
    typeof s.salt !== 'string' ||
    typeof s.signature !== 'string' ||
    !Number.isInteger(s.number) ||
    s.number < 0
  )
    return null;
  const expire = Number(/[?&]expires=(\d+)/.exec(s.salt)?.[1]);
  if (!expire || expire * 1000 < maintenant) return null;
  if (!egaux(sha256(`${s.salt}${s.number}`), s.challenge)) return null;
  if (!egaux(hmac(cle, s.challenge), s.signature)) return null;
  return { signature: s.signature, expireLe: expire * 1000 };
}
