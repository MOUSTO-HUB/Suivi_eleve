// « Je ne suis pas un robot » (protocole ALTCHA, copie de web/lib/altcha.ts) : le
// téléphone cherche le nombre qui donne l'empreinte demandée par l'API.
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export interface DefiAltcha {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

/** Résout le défi par paquets, sans figer l'écran ; renvoie la réponse à envoyer à l'API. */
export async function resoudreAltcha(defi: DefiAltcha): Promise<string> {
  const PAQUET = 1000;
  for (let debut = 0; debut <= defi.maxnumber; debut += PAQUET) {
    const fin = Math.min(debut + PAQUET, defi.maxnumber + 1);
    for (let n = debut; n < fin; n++) {
      if (
        bytesToHex(sha256(utf8ToBytes(`${defi.salt}${n}`))) === defi.challenge
      )
        return btoa(
          JSON.stringify({
            algorithm: defi.algorithm,
            challenge: defi.challenge,
            number: n,
            salt: defi.salt,
            signature: defi.signature,
          }),
        );
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('Défi ALTCHA sans solution.');
}
