// Aides des tests e2e : « Je ne suis pas un robot » et connexion complète du personnel.
import { createHash } from 'node:crypto';
import type request from 'supertest';
import type { Response } from 'supertest';
import { ENVOIS_SIMULES } from '../src/notifications/fournisseurs/fournisseurs.js';
import { creerDefi } from '../src/securite/altcha.js';

/** Réponse ALTCHA valable (même clé que l'API : dérivée de JWT_SECRET). */
export function altcha(): string {
  const defi = creerDefi(`altcha:${process.env.JWT_SECRET}`, 500);
  let n = 0;
  while (
    createHash('sha256').update(`${defi.salt}${n}`).digest('hex') !==
    defi.challenge
  )
    n++;
  const { algorithm, challenge, salt, signature } = defi;
  return Buffer.from(
    JSON.stringify({ algorithm, challenge, number: n, salt, signature }),
  ).toString('base64');
}

const MOTIF_CODE = /code de connexion est (\d{6})/;

/** Dernier code de double authentification « envoyé » (fournisseur email simulé). */
export function dernierCodeEmail(adresse: string): string {
  const envoi = ENVOIS_SIMULES.findLast(
    (e) => e.destinataire === adresse && MOTIF_CODE.test(e.texte),
  );
  if (!envoi) throw new Error(`Aucun code envoyé à ${adresse}.`);
  return MOTIF_CODE.exec(envoi.texte)![1];
}

/**
 * Connexion du personnel jusqu'à la session : mot de passe, puis code reçu par
 * email si la double authentification s'applique. Vérifie le statut final.
 */
export async function connecter(
  http: () => ReturnType<typeof request>,
  email: string,
  motDePasse: string,
  statut = 200,
): Promise<Response> {
  const etape1 = await http()
    .post('/api/auth/connexion')
    .send({ email, motDePasse, altcha: altcha() });
  const defi = (etape1.body as { doubleAuth?: { jeton: string } }).doubleAuth;
  if (etape1.status !== 200 || !defi) {
    expect(etape1.status).toBe(statut);
    return etape1;
  }
  const etape2 = await http()
    .post('/api/auth/double-auth/verification')
    .send({ jeton: defi.jeton, code: dernierCodeEmail(email) });
  expect(etape2.status).toBe(statut);
  return etape2;
}
