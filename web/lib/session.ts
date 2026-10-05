// Noms et options des cookies de session (httpOnly : jamais lisibles par le navigateur).
export const COOKIE_ACCES = 'suivi_acces';
export const COOKIE_RAFRAICHISSEMENT = 'suivi_rafraichissement';

const PROD = process.env.NODE_ENV === 'production';

export const optionsCookie = (maxAgeSecondes: number) => ({
  httpOnly: true,
  secure: PROD,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeSecondes,
});

export const DUREE_ACCES_S = 15 * 60;
export const DUREE_RAFRAICHISSEMENT_S = 30 * 24 * 60 * 60;

export const API_URL = process.env.API_URL ?? 'http://localhost:3100/api';

export interface Session {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: { id: string; role: string; ecoleId: string };
}

/**
 * Date d'expiration (ms) lue dans le jeton d'accès, sans vérifier la signature :
 * sert seulement à décider quand le renouveler. L'API, elle, vérifie tout.
 */
export function expirationJeton(jeton: string): number | null {
  try {
    const charge = JSON.parse(
      Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    return charge.exp ? charge.exp * 1000 : null;
  } catch {
    return null;
  }
}
