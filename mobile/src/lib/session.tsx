import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  envoyer,
  ErreurApi,
  fermerSession,
  lire,
  ouvrirSession,
  quandSessionExpiree,
  reprendreSession,
} from './api';
import { desinscrirePush, inscrirePush } from './push';
import { viderCache } from './stockage-local';
import type { Session, Utilisateur } from './types';

/** Étape 2 de la connexion du personnel (double authentification). */
export interface EtapeDoubleAuth {
  jeton: string;
  methode: 'APPLICATION' | 'EMAIL';
  /** Adresse masquée où le code a été envoyé. */
  email?: string;
}

interface ContexteSession {
  /** Vrai tant que la session enregistrée est en cours de reprise. */
  chargement: boolean;
  utilisateur: Utilisateur | null;
  dernierUtilisateur: Utilisateur | null;
  demanderCode: (telephone: string, altcha: string) => Promise<void>;
  verifierCode: (telephone: string, code: string) => Promise<void>;
  /** Renvoie l'étape du code si la double authentification s'applique, sinon ouvre la session. */
  connexionPersonnel: (
    email: string,
    motDePasse: string,
    altcha: string,
  ) => Promise<EtapeDoubleAuth | null>;
  verifierDoubleAuth: (jeton: string, code: string) => Promise<void>;
  renvoyerCodeEmail: (jeton: string) => Promise<void>;
  deconnexion: () => Promise<void>;
  /** Le parent accepte le texte d'information (consentement stocké par l'API). */
  consentir: (version: string) => Promise<void>;
}

const Contexte = createContext<ContexteSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [chargement, setChargement] = useState(true);
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  // Dernier utilisateur connu : les écrans protégés en ont besoin le temps de se fermer.
  const [dernier, setDernier] = useState<Utilisateur | null>(null);

  const ouvrir = useCallback(async (session: Session) => {
    await ouvrirSession(session);
    // La session ne contient que l'identifiant et le rôle : le profil donne le nom.
    const profil = await lire<Utilisateur>('/auth/moi').catch(() => null);
    const u = profil ?? session.utilisateur;
    setUtilisateur(u);
    setDernier(u);
    // Sans attendre : l'accès à l'application ne dépend pas du push.
    void inscrirePush();
  }, []);

  useEffect(() => {
    quandSessionExpiree(() => setUtilisateur(null));
    reprendreSession()
      .then((s) => s && ouvrir(s))
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, [ouvrir]);

  const ouvrirPersonnel = useCallback(
    async (session: Session) => {
      // Le concepteur administre les écoles depuis le site web seulement.
      if (session.utilisateur.role === 'SUPER_ADMIN') {
        await envoyer('/auth/deconnexion', 'POST', {
          jetonRafraichissement: session.jetonRafraichissement,
        }).catch(() => undefined);
        throw new ErreurApi(
          403,
          "L'espace concepteur s'utilise sur le site web de Suivi_eleve.",
        );
      }
      await ouvrir(session);
    },
    [ouvrir],
  );

  const valeur = useMemo<ContexteSession>(
    () => ({
      chargement,
      utilisateur,
      dernierUtilisateur: dernier,
      consentir: async (version) => {
        const profil = await envoyer<Utilisateur>(
          '/auth/consentement',
          'POST',
          { version },
        );
        setUtilisateur(profil);
        setDernier(profil);
      },
      demanderCode: async (telephone, altcha) => {
        await envoyer('/auth/otp/demande', 'POST', { telephone, altcha });
      },
      verifierCode: async (telephone, code) => {
        await ouvrir(
          await envoyer<Session>('/auth/otp/verification', 'POST', {
            telephone,
            code,
          }),
        );
      },
      connexionPersonnel: async (email, motDePasse, altcha) => {
        const reponse = await envoyer<
          Session | { doubleAuth: EtapeDoubleAuth }
        >('/auth/connexion', 'POST', { email, motDePasse, altcha });
        if ('doubleAuth' in reponse) return reponse.doubleAuth;
        await ouvrirPersonnel(reponse);
        return null;
      },
      verifierDoubleAuth: async (jeton, code) => {
        await ouvrirPersonnel(
          await envoyer<Session>('/auth/double-auth/verification', 'POST', {
            jeton,
            code,
          }),
        );
      },
      renvoyerCodeEmail: async (jeton) => {
        await envoyer('/auth/double-auth/renvoi', 'POST', { jeton });
      },
      deconnexion: async () => {
        await desinscrirePush();
        await fermerSession();
        await viderCache();
        setUtilisateur(null);
      },
    }),
    [chargement, utilisateur, dernier, ouvrir, ouvrirPersonnel],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): ContexteSession {
  const c = useContext(Contexte);
  if (!c) throw new Error('useSession hors de FournisseurSession');
  return c;
}

/**
 * Utilisateur connecté (les écrans protégés ne s'affichent qu'avec une session).
 * Garde le dernier connu le temps que ces écrans se ferment après une déconnexion.
 */
export function useUtilisateur(): Utilisateur {
  const { utilisateur, dernierUtilisateur } = useSession();
  const u = utilisateur ?? dernierUtilisateur;
  if (!u) throw new Error('Aucun utilisateur connecté');
  return u;
}
