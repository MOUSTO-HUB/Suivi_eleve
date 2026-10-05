// Règles du moteur de notifications (cahier des charges, section 3.9), sans accès à la base.
import {
  CanalNotification,
  PrioriteNotification,
  TypeNotification,
} from '../generated/prisma/enums.js';

const { SMS, EMAIL, PUSH } = CanalNotification;

interface RegleType {
  canaux: CanalNotification[];
  priorite: PrioriteNotification;
  /** Part même si le parent a désactivé ce type (EF-84). */
  obligatoire: boolean;
}

/** Tableau « Type de notification » du cahier des charges. */
export const REGLES_TYPE: Record<TypeNotification, RegleType> = {
  LIBERATION_ANTICIPEE: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'URGENTE',
    obligatoire: true,
  },
  PAS_DE_COURS: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'HAUTE',
    obligatoire: true,
  },
  // Absence injustifiée d'un élève : la famille doit toujours être prévenue.
  ABSENCE: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'HAUTE',
    obligatoire: true,
  },
  COMPORTEMENT: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'HAUTE',
    obligatoire: true,
  },
  RETARD_PAIEMENT: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'NORMALE',
    obligatoire: true,
  },
  RAPPEL_PAIEMENT: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'NORMALE',
    obligatoire: false,
  },
  RESULTATS: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'NORMALE',
    obligatoire: false,
  },
  DECISION_FIN_ANNEE: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'NORMALE',
    obligatoire: false,
  },
  EVENEMENT: {
    canaux: [SMS, EMAIL, PUSH],
    priorite: 'NORMALE',
    obligatoire: false,
  },
  RECU_PAIEMENT: {
    canaux: [EMAIL, PUSH],
    priorite: 'BASSE',
    obligatoire: false,
  },
  USAGE_APPAREIL: {
    canaux: [EMAIL, PUSH],
    priorite: 'NORMALE',
    obligatoire: false,
  },
  APPAREIL: { canaux: [EMAIL, PUSH], priorite: 'NORMALE', obligatoire: false },
};

/** Priorité BullMQ : 1 est servi en premier. */
export const PRIORITE_FILE: Record<PrioriteNotification, number> = {
  URGENTE: 1,
  HAUTE: 2,
  NORMALE: 3,
  BASSE: 4,
};

/** Remplace {variable} ; une variable inconnue devient une chaîne vide. */
export function rendre(
  modele: string,
  variables: Record<string, string | undefined>,
): string {
  return modele
    .replace(/\{([a-z_]+)\}/g, (_, nom: string) => variables[nom] ?? '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,])/g, '$1')
    .trim();
}

/** Variables utilisées par un modèle, pour l'aide à la saisie et le contrôle. */
export const variablesDuModele = (modele: string): string[] => [
  ...new Set([...modele.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1])),
];

// Alphabet GSM 03.38 (base + extension) : un SMS reste à 160 caractères s'il n'en sort pas.
const GSM7 = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€'.split(
    '',
  ),
);
const REMPLACEMENTS: Record<string, string> = {
  â: 'a',
  á: 'a',
  ã: 'a',
  ê: 'e',
  ë: 'e',
  î: 'i',
  ï: 'i',
  í: 'i',
  ô: 'o',
  ó: 'o',
  õ: 'o',
  û: 'u',
  ú: 'u',
  ç: 'c',
  œ: 'oe',
  Œ: 'OE',
  À: 'A',
  Â: 'A',
  È: 'E',
  Ê: 'E',
  Ë: 'E',
  Î: 'I',
  Ï: 'I',
  Ô: 'O',
  Ù: 'U',
  Û: 'U',
  '’': "'",
  '‘': "'",
  '«': '"',
  '»': '"',
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  ' ': ' ',
  ' ': ' ',
};

/**
 * Ramène un texte à l'alphabet GSM : un seul caractère hors alphabet (ê, ç, ’…)
 * ferait passer le SMS en Unicode, limité à 70 caractères au lieu de 160.
 */
const GRAPHEMES = new Intl.Segmenter('fr', { granularity: 'grapheme' });

export function versGsm7(texte: string): string {
  const enGsm = (s: string) => s.split('').every((c) => GSM7.has(c));
  // Découpage par caractère affiché : un emoji, même composé, devient un seul « ? ».
  return Array.from(GRAPHEMES.segment(texte), ({ segment: c }) => {
    if (GSM7.has(c)) return c;
    const remplacement =
      REMPLACEMENTS[c] ?? c.normalize('NFD').replace(/\p{Mn}/gu, '');
    return enGsm(remplacement) ? remplacement : '?';
  }).join('');
}

export const LONGUEUR_SMS = 160;

/** SMS prêt à envoyer : alphabet GSM, une ligne, 160 caractères au plus. */
export function preparerSms(texte: string): string {
  const ligne = versGsm7(texte.replace(/\s*\n+\s*/g, ' ')).trim();
  return ligne.length <= LONGUEUR_SMS
    ? ligne
    : `${ligne.slice(0, LONGUEUR_SMS - 3).trimEnd()}...`;
}

/** « Awa », « Awa et Ali », « Awa, Ali et Fatou ». */
export function enumerer(elements: string[]): string {
  const uniques = [...new Set(elements.filter(Boolean))];
  if (uniques.length <= 1) return uniques[0] ?? '';
  return `${uniques.slice(0, -1).join(', ')} et ${uniques.at(-1)}`;
}

/** Statut suivant après un accusé de livraison : jamais de retour en arrière. */
const RANG = {
  EN_FILE: 0,
  ENVOYEE: 1,
  DELIVREE: 2,
  LUE: 3,
  ECHOUEE: 2,
} as const;
export const doitMettreAJour = (
  actuel: keyof typeof RANG,
  nouveau: keyof typeof RANG,
): boolean =>
  actuel !== nouveau && RANG[nouveau] >= RANG[actuel] && actuel !== 'LUE';
