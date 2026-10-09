'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DefiAltcha } from '@/lib/altcha';
import { transmettreIp, type EtatFormulaire } from '@/lib/api';
import {
  estPays,
  paysParDefaut,
  TELEPHONE_PAYS,
  telephoneE164,
} from '@/lib/pays';
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

const COOKIE_DOUBLE_AUTH = 'suivi_double_auth';

/** Défi « Je ne suis pas un robot », demandé par la case du formulaire. */
export async function obtenirDefiAltcha(): Promise<DefiAltcha | null> {
  try {
    const reponse = await fetch(`${API_URL}/auth/altcha`, {
      cache: 'no-store',
    });
    return reponse.ok ? ((await reponse.json()) as DefiAltcha) : null;
  } catch {
    return null;
  }
}

const SANS_ROBOT = {
  erreur: 'Cochez la case « Je ne suis pas un robot » puis réessayez.',
};
const altcha = (donnees: FormData) => String(donnees.get('altcha') ?? '');

interface DefiDoubleAuth {
  doubleAuth: {
    jeton: string;
    methode: 'APPLICATION' | 'EMAIL';
    email?: string;
  };
}

export async function seConnecter(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  if (!altcha(donnees)) return SANS_ROBOT;
  const reponse = await appelAuth('/auth/connexion', {
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
    altcha: altcha(donnees),
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok) {
    return {
      erreur:
        reponse.status === 401
          ? 'Email ou mot de passe incorrect. Attention : après 3 essais incorrects, le compte est bloqué 30 minutes.'
          : (await message(reponse)) ||
            'Connexion impossible. Vérifiez les informations saisies.',
    };
  }
  const suite = cheminSur(donnees.get('suite'), '/eleves');
  const corps = (await reponse.json()) as Session | DefiDoubleAuth;
  if ('doubleAuth' in corps) {
    // Étape 2 : le jeton d'étape reste côté serveur (cookie httpOnly, 10 minutes).
    (await cookies()).set(
      COOKIE_DOUBLE_AUTH,
      corps.doubleAuth.jeton,
      optionsCookie(10 * 60),
    );
    const params = new URLSearchParams({
      espace: 'personnel',
      etape: 'code',
      methode: corps.doubleAuth.methode,
      suite,
    });
    if (corps.doubleAuth.email) params.set('email', corps.doubleAuth.email);
    redirect(`/connexion?${params}`);
  }
  await ouvrirSession(corps);
  redirect(suite);
}

/** Étape 2 : code de l'application, reçu par email, ou code de secours. */
export async function verifierDoubleAuth(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_DOUBLE_AUTH)?.value;
  if (!jeton)
    return {
      erreur:
        'Étape expirée : saisissez à nouveau votre email et votre mot de passe.',
    };
  const reponse = await appelAuth('/auth/double-auth/verification', {
    jeton,
    code: String(donnees.get('code') ?? '').trim(),
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok)
    return { erreur: (await message(reponse)) || 'Code incorrect.' };
  magasin.delete(COOKIE_DOUBLE_AUTH);
  await ouvrirSession((await reponse.json()) as Session);
  redirect(cheminSur(donnees.get('suite'), '/eleves'));
}

/** Étape 2 par email : renvoyer un code. */
export async function renvoyerCodeEmail(): Promise<Etat> {
  const jeton = (await cookies()).get(COOKIE_DOUBLE_AUTH)?.value;
  if (!jeton)
    return {
      erreur:
        'Étape expirée : saisissez à nouveau votre email et votre mot de passe.',
    };
  const reponse = await appelAuth('/auth/double-auth/renvoi', { jeton });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok) return { erreur: await message(reponse) };
  return { succes: 'Un nouveau code vient d’être envoyé par email.' };
}

/** Mot de passe oublié : lien envoyé par email (même réponse que l'adresse soit connue ou non). */
export async function demanderLien(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  if (!altcha(donnees)) return SANS_ROBOT;
  const reponse = await appelAuth('/auth/mot-de-passe/oubli', {
    email: donnees.get('email'),
    altcha: altcha(donnees),
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok)
    return { erreur: (await message(reponse)) || 'Adresse email invalide.' };
  return {
    succes:
      'Si cette adresse correspond à un compte, un lien vient d’y être envoyé. Il est valable 30 minutes. Pensez à regarder dans les courriers indésirables.',
  };
}

/** Nouveau mot de passe choisi depuis le lien reçu par email. */
export async function choisirMotDePasse(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const nouveau = String(donnees.get('nouveau') ?? '');
  if (nouveau !== donnees.get('confirmation'))
    return { erreur: 'Les deux mots de passe ne sont pas identiques.' };
  const reponse = await appelAuth('/auth/mot-de-passe/reinitialisation', {
    jeton: donnees.get('jeton'),
    nouveau,
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok)
    return { erreur: (await message(reponse)) || 'Lien invalide ou expiré.' };
  redirect('/connexion?espace=personnel&motDePasse=change');
}

/** Parent, étape 1 : envoi du code par SMS, puis saisie du code. */
export async function demanderCode(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const choix = donnees.get('pays');
  const pays = estPays(choix) ? choix : paysParDefaut();
  const telephone = telephoneE164(String(donnees.get('telephone') ?? ''), pays);
  // Le pays choisi est proposé à la prochaine connexion.
  (await cookies()).set('pays', pays, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 3600,
    path: '/',
  });
  if (!altcha(donnees)) return SANS_ROBOT;
  const reponse = await appelAuth('/auth/otp/demande', {
    telephone,
    altcha: altcha(donnees),
  });
  if (!reponse) return HORS_LIGNE;
  if (!reponse.ok) {
    return {
      erreur:
        (await message(reponse)) ||
        `Numéro invalide : saisissez par exemple ${TELEPHONE_PAYS[pays].exemple}.`,
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
