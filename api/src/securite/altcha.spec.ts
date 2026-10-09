import { createHash } from 'node:crypto';
import { creerDefi, verifierSolution, type Defi } from './altcha.js';

const CLE = 'cle-altcha-test';

/** Ce que fait le navigateur : chercher le nombre qui donne l'empreinte. */
function resoudre(defi: Defi, nombre?: number): string {
  let n = nombre ?? 0;
  if (nombre === undefined)
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

describe('ALTCHA', () => {
  const maintenant = Date.UTC(2026, 9, 9, 12);
  const defi = creerDefi(CLE, 2000, maintenant);

  it('accepte la bonne solution', () => {
    expect(verifierSolution(resoudre(defi), CLE, maintenant)).toEqual({
      signature: defi.signature,
      expireLe: maintenant + 10 * 60_000,
    });
  });

  it('refuse un mauvais nombre, une autre clé, un défi expiré ou du bruit', () => {
    const bonne = resoudre(defi);
    const { number } = JSON.parse(Buffer.from(bonne, 'base64').toString()) as {
      number: number;
    };
    expect(
      verifierSolution(resoudre(defi, number + 1), CLE, maintenant),
    ).toBeNull();
    expect(verifierSolution(bonne, 'autre', maintenant)).toBeNull();
    expect(verifierSolution(bonne, CLE, maintenant + 11 * 60_000)).toBeNull();
    expect(verifierSolution('pas du base64 {', CLE, maintenant)).toBeNull();
    expect(verifierSolution('', CLE, maintenant)).toBeNull();
  });

  it('refuse un défi fabriqué sans la clé du serveur', () => {
    const salt = `abc?expires=${maintenant / 1000 + 600}`;
    const faux: Defi = {
      ...defi,
      salt,
      challenge: createHash('sha256').update(`${salt}1`).digest('hex'),
    };
    expect(verifierSolution(resoudre(faux, 1), CLE, maintenant)).toBeNull();
  });
});
