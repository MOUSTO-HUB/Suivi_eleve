import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ErreurApi, lire } from './api';
import {
  enfantActifEnregistre,
  enregistrerEnfantActif,
} from './stockage-local';
import type { Enfant, Page } from './types';

interface ContexteEnfants {
  enfants: Enfant[];
  /** Enfant dont le parent consulte le dossier (le seul s'il n'en a qu'un). */
  enfant: Enfant | null;
  choisir: (id: string) => void;
  chargement: boolean;
  erreur: string | null;
  recharger: () => Promise<void>;
}

const Contexte = createContext<ContexteEnfants | null>(null);

export function FournisseurEnfants({ children }: { children: ReactNode }) {
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [actif, setActif] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(
    () =>
      Promise.all([
        lire<Page<Enfant>>('/eleves?parPage=20'),
        enfantActifEnregistre(),
      ])
        .then(([page, enregistre]) => {
          setEnfants(page.elements);
          setActif((courant) => courant ?? enregistre);
          setErreur(null);
        })
        .catch((e: unknown) =>
          setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.'),
        )
        .finally(() => setChargement(false)),
    [],
  );

  const recharger = useCallback(async () => {
    setChargement(true);
    await charger();
  }, [charger]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const valeur = useMemo<ContexteEnfants>(
    () => ({
      enfants,
      enfant: enfants.find((e) => e.id === actif) ?? enfants[0] ?? null,
      choisir: (id) => {
        setActif(id);
        void enregistrerEnfantActif(id);
      },
      chargement,
      erreur,
      recharger,
    }),
    [enfants, actif, chargement, erreur, recharger],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useEnfants(): ContexteEnfants {
  const c = useContext(Contexte);
  if (!c) throw new Error('useEnfants hors de FournisseurEnfants');
  return c;
}
