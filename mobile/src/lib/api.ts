import { effacerSecret, ecrireSecret, lireSecret } from './stockage-securise';
import type { Session } from './types';

/** Adresse de l'API (ex. http://192.168.1.20:3100/api pour un téléphone sur le même Wi-Fi). */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3100/api'
).replace(/\/$/, '');

const CLE_RAFRAICHISSEMENT = 'suivi.jetonRafraichissement';

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
  }
}

let jetonAcces: string | null = null;
let rafraichissementEnCours: Promise<string | null> | null = null;
let surSessionExpiree: () => void = () => undefined;

/** Appelé par la session : déconnecte l'interface si le renouvellement échoue. */
export function quandSessionExpiree(rappel: () => void) {
  surSessionExpiree = rappel;
}

export async function ouvrirSession(session: Session) {
  jetonAcces = session.jetonAcces;
  await ecrireSecret(CLE_RAFRAICHISSEMENT, session.jetonRafraichissement);
}

export async function fermerSession() {
  const jeton = await lireSecret(CLE_RAFRAICHISSEMENT);
  jetonAcces = null;
  await effacerSecret(CLE_RAFRAICHISSEMENT);
  if (jeton) {
    await fetch(`${API_URL}/auth/deconnexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jetonRafraichissement: jeton }),
    }).catch(() => undefined);
  }
}

/** Reprend la session enregistrée (au lancement) ; null si elle a expiré. */
export async function reprendreSession(): Promise<Session | null> {
  const jeton = await lireSecret(CLE_RAFRAICHISSEMENT);
  if (!jeton) return null;
  const reponse = await fetch(`${API_URL}/auth/rafraichir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jetonRafraichissement: jeton }),
  });
  if (reponse.status === 401 || reponse.status === 400) {
    await effacerSecret(CLE_RAFRAICHISSEMENT);
    return null;
  }
  if (!reponse.ok) throw new ErreurApi(reponse.status, 'Serveur indisponible.');
  const session = (await reponse.json()) as Session;
  await ouvrirSession(session);
  return session;
}

/** Un seul renouvellement à la fois, même si plusieurs appels échouent ensemble. */
function renouveler(): Promise<string | null> {
  rafraichissementEnCours ??= reprendreSession()
    .then((s) => s?.jetonAcces ?? null)
    .catch(() => null)
    .finally(() => {
      rafraichissementEnCours = null;
    });
  return rafraichissementEnCours;
}

function messageErreur(corps: unknown, statut: number): string {
  const message = (corps as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return `Erreur ${statut} du serveur.`;
}

export async function appelBrut(
  chemin: string,
  init: RequestInit = {},
  renouvele = false,
): Promise<Response> {
  const entetes = new Headers(init.headers);
  if (jetonAcces) entetes.set('Authorization', `Bearer ${jetonAcces}`);
  if (init.body) entetes.set('Content-Type', 'application/json');
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, { ...init, headers: entetes });
  } catch {
    throw new ErreurApi(0, 'Pas de connexion. Vérifiez votre réseau.');
  }
  if (reponse.status === 401 && !renouvele) {
    const nouveau = await renouveler();
    if (nouveau) return appelBrut(chemin, init, true);
    surSessionExpiree();
  }
  if (!reponse.ok) {
    const corps: unknown = await reponse.json().catch(() => null);
    throw new ErreurApi(reponse.status, messageErreur(corps, reponse.status));
  }
  return reponse;
}

export async function lire<T>(chemin: string): Promise<T> {
  return (await (await appelBrut(chemin)).json()) as T;
}

export async function envoyer<T>(
  chemin: string,
  methode: 'POST' | 'PUT' | 'DELETE',
  corps?: unknown,
): Promise<T> {
  const reponse = await appelBrut(chemin, {
    method: methode,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

/** Jeton courant, pour un téléchargement de fichier. */
export async function jetonCourant(): Promise<string | null> {
  return jetonAcces ?? (await renouveler());
}
