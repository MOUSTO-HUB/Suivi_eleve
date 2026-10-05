'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { transmettreIp, type EtatFormulaire } from '@/lib/api';
import {
  API_URL,
  COOKIE_ACCES,
  COOKIE_RAFRAICHISSEMENT,
  DUREE_ACCES_S,
  DUREE_RAFRAICHISSEMENT_S,
  optionsCookie,
  type Session,
} from '@/lib/session';

type Etat = EtatFormulaire | null;

/** N'accepte qu'un chemin interne : empêche une redirection vers un autre site. */
const cheminSur = (suite: FormDataEntryValue | null, defaut: string) =>
  typeof suite === 'string' && suite.startsWith('/') && !suite.startsWith('//')
    ? suite
    : defaut;

/** « 77 123 45 67 » → « +221771234567 » (Sénégal par défaut). */
function telephoneE164(saisie: string): string {
  let n = saisie.replace(/[\s.()-]/g, '');
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  if (/^\d{9}$/.test(n)) n = `+221${n}`;
  else if (/^221\d{9}$/.test(n)) n = `+${n}`;
  return n;
}

/** Appel public de l'API d'authentification, avec l'IP du visiteur. */
async function appelAuth(
  chemin: string,
  corps: unknown,
): Promise<Response | null> {
  const entetes = new Headers({ 'Content-Type': 'application/json' });
  await transmettreIp(entetes);
  try {
    return await fetch(`${API_URL}${chemin}`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify(corps),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}

async function message(reponse: Response): Promise<string> {
  const corps = (await reponse.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const m = corps?.message;
  return Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : '';
}

async function ouvrirSession(session: Session) {
  const magasin = await cookies();
  magasin.set(COOKIE_ACCES, session.jetonAcces, optionsCookie(DUREE_ACCES_S));
  magasin.set(
    COOKIE_RAFRAICHISSEMENT,
    session.jetonRafraichissement,
    optionsCookie(DUREE_RAFRAICHISSEMENT_S),
  );
}

const HORS_LIGNE = {
  erreur: "Le serveur ne répond pas. Vérifiez que l'API est démarrée.",
};

export async function seConnecter(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const reponse = await appelAuth('/auth/connexion', {
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok) {
    return {
      erreur:
        reponse.status === 401
          ? 'Email ou mot de passe incorrect.'
          : reponse.status === 429
            ? await message(reponse)
            : 'Connexion impossible. Vérifiez les informations saisies.',
    };
  }
  await ouvrirSession((await reponse.json()) as Session);
  redirect(cheminSur(donnees.get('suite'), '/eleves'));
}

/** Parent, étape 1 : envoi du code par SMS, puis saisie du code. */
export async function demanderCode(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const telephone = telephoneE164(String(donnees.get('telephone') ?? ''));
  const reponse = await appelAuth('/auth/otp/demande', { telephone });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok) {
    return {
      erreur:
        (await message(reponse)) ||
        'Numéro invalide : saisissez par exemple 77 123 45 67.',
    };
  }
  redirect(
    `/connexion?espace=parent&telephone=${encodeURIComponent(telephone)}`,
  );
}

/** Parent, étape 2 : vérification du code reçu. */
export async function verifierCode(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const reponse = await appelAuth('/auth/otp/verification', {
    telephone: donnees.get('telephone'),
    code: String(donnees.get('code') ?? '').replace(/\D/g, ''),
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok)
    return { erreur: (await message(reponse)) || 'Code incorrect.' };
  await ouvrirSession((await reponse.json()) as Session);
  redirect('/parent');
}

export async function seDeconnecter(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_RAFRAICHISSEMENT)?.value;
  if (jeton) {
    await fetch(`${API_URL}/auth/deconnexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jetonRafraichissement: jeton }),
      cache: 'no-store',
    }).catch(() => undefined);
  }
  magasin.delete(COOKIE_ACCES);
  magasin.delete(COOKIE_RAFRAICHISSEMENT);
  redirect('/connexion');
}
