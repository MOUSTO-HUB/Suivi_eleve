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
  fermerSession,
  lire,
  ouvrirSession,
  quandSessionExpiree,
  reprendreSession,
} from './api';
import { desinscrirePush, inscrirePush } from './push';
import { viderCache } from './stockage-local';
import type { Session, Utilisateur } from './types';

interface ContexteSession {
  /** Vrai tant que la session enregistrée est en cours de reprise. */
  chargement: boolean;
  utilisateur: Utilisateur | null;
  dernierUtilisateur: Utilisateur | null;
  demanderCode: (telephone: string) => Promise<void>;
  verifierCode: (telephone: string, code: string) => Promise<void>;
  connexionPersonnel: (email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
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

  const valeur = useMemo<ContexteSession>(
    () => ({
      chargement,
      utilisateur,
      dernierUtilisateur: dernier,
      demanderCode: async (telephone) => {
        await envoyer('/auth/otp/demande', 'POST', { telephone });
      },
      verifierCode: async (telephone, code) => {
        await ouvrir(
          await envoyer<Session>('/auth/otp/verification', 'POST', {
            telephone,
            code,
          }),
        );
      },
      connexionPersonnel: async (email, motDePasse) => {
        await ouvrir(
          await envoyer<Session>('/auth/connexion', 'POST', {
            email,
            motDePasse,
          }),
        );
      },
      deconnexion: async () => {
        await desinscrirePush();
        await fermerSession();
        await viderCache();
        setUtilisateur(null);
      },
    }),
    [chargement, utilisateur, dernier, ouvrir],
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
