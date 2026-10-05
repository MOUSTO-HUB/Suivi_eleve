'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { EtatFormulaire } from '@/lib/api';
import {
  API_URL,
  COOKIE_ACCES,
  COOKIE_RAFRAICHISSEMENT,
  DUREE_ACCES_S,
  DUREE_RAFRAICHISSEMENT_S,
  optionsCookie,
  type Session,
} from '@/lib/session';

/** N'accepte qu'un chemin interne : empêche une redirection vers un autre site. */
const cheminSur = (suite: FormDataEntryValue | null) =>
  typeof suite === 'string' && suite.startsWith('/') && !suite.startsWith('//')
    ? suite
    : '/eleves';

export async function seConnecter(
  _etat: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire | null> {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/auth/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: donnees.get('email'),
        motDePasse: donnees.get('motDePasse'),
      }),
      cache: 'no-store',
    });
  } catch {
    return {
      erreur: "Le serveur ne répond pas. Vérifiez que l'API est démarrée.",
    };
  }
  if (!reponse.ok) {
    return {
      erreur:
        reponse.status === 401
          ? 'Email ou mot de passe incorrect.'
          : 'Connexion impossible. Vérifiez les informations saisies.',
    };
  }

  const session = (await reponse.json()) as Session;
  const magasin = await cookies();
  magasin.set(COOKIE_ACCES, session.jetonAcces, optionsCookie(DUREE_ACCES_S));
  magasin.set(
    COOKIE_RAFRAICHISSEMENT,
    session.jetonRafraichissement,
    optionsCookie(DUREE_RAFRAICHISSEMENT_S),
  );
  redirect(cheminSur(donnees.get('suite')));
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
