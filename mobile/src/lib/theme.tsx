import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, type ViewStyle } from 'react-native';

/**
 * Thème « bleu école », clair ou sombre au choix de l'utilisateur
 * (bouton ☀️/🌙), sans tenir compte du réglage du téléphone ; clair par défaut.
 */
export type Theme = 'clair' | 'sombre';

const CLAIR = {
  primaire: '#1d4ed8',
  primaireClair: '#eff6ff',
  titre: '#172554',
  texte: '#0f172a',
  secondaire: '#475569',
  bordure: '#dbe5f3',
  bordureChamp: '#cbd5e1',
  indice: '#94a3b8',
  fond: '#f4f7fc',
  carte: '#ffffff',
  /** Texte posé sur un dégradé ou un fond bleu plein. */
  surPrimaire: '#ffffff',
  neutreClair: '#f1f5f9',
  neutre: '#334155',
  ok: '#047857',
  okClair: '#ecfdf5',
  danger: '#b91c1c',
  dangerClair: '#fef2f2',
  alerte: '#b45309',
  alerteClair: '#fffbeb',
  soleil: '#fcbb00',
  /** Boutons et pastille active : bleu vers bleu ciel. */
  degrade: ['#193cb8', '#155dfc', '#00a6f4'],
  /** Bandeau : bleu nuit vers bleu ciel. */
  bandeau: ['#162456', '#193cb8', '#00a6f4'],
};

export type Couleurs = typeof CLAIR;

const SOMBRE: Couleurs = {
  primaire: '#60a5fa',
  primaireClair: '#0c1730',
  titre: '#dbeafe',
  texte: '#f1f5f9',
  secondaire: '#a9b6c8',
  bordure: '#1e293b',
  bordureChamp: '#334155',
  indice: '#64748b',
  fond: '#05070d',
  carte: '#0d1322',
  surPrimaire: '#ffffff',
  neutreClair: '#141c2e',
  neutre: '#cbd5e1',
  ok: '#a7f3d0',
  okClair: '#052e22',
  danger: '#fca5a5',
  dangerClair: '#2a0e12',
  alerte: '#fcd34d',
  alerteClair: '#2a1d05',
  soleil: '#fcbb00',
  degrade: ['#172554', '#1d4ed8', '#0284c7'],
  bandeau: ['#020617', '#172554', '#0284c7'],
};

export const PALETTES: Record<Theme, Couleurs> = {
  clair: CLAIR,
  sombre: SOMBRE,
};

/** Fond en dégradé : propriété native (Android, iPhone) ou CSS (navigateur). */
export function degrade(teintes: string[], angle = 135): ViewStyle {
  const css = `linear-gradient(${angle}deg, ${teintes[0]}, ${teintes[1]} 55%, ${teintes[2]})`;
  return Platform.OS === 'web'
    ? ({ backgroundColor: teintes[1], backgroundImage: css } as ViewStyle)
    : { backgroundColor: teintes[1], experimental_backgroundImage: css };
}

const CLE_THEME = 'suivi.theme';

const Contexte = createContext<{
  theme: Theme;
  couleurs: Couleurs;
  basculer: () => void;
}>({ theme: 'clair', couleurs: CLAIR, basculer: () => undefined });

export function FournisseurTheme({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('clair');

  // Choix gardé sur le téléphone (même après déconnexion).
  useEffect(() => {
    void AsyncStorage.getItem(CLE_THEME)
      .then((t) => (t === 'sombre' || t === 'clair') && setTheme(t))
      .catch(() => undefined);
  }, []);

  const valeur = useMemo(
    () => ({
      theme,
      couleurs: PALETTES[theme],
      basculer: () => {
        const suivant: Theme = theme === 'sombre' ? 'clair' : 'sombre';
        setTheme(suivant);
        void AsyncStorage.setItem(CLE_THEME, suivant).catch(() => undefined);
      },
    }),
    [theme],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export const useTheme = () => useContext(Contexte);

/** Feuille de style recalculée quand le thème change. */
export function useStyles<T>(fabrique: (couleurs: Couleurs) => T): T {
  const { couleurs } = useTheme();
  return useMemo(() => fabrique(couleurs), [fabrique, couleurs]);
}
