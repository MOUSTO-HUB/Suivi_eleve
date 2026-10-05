// Mise en forme et règles d'affichage, sans dépendance à React Native (testées).
import type {
  Appareil,
  Notification,
  Role,
  StatutAppareil,
  TypeNotification,
  TypeSignalement,
} from './types';

const FUSEAU = 'Africa/Dakar';

/** « 15/11/2026 » */
export const dateFr = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(
    'fr-FR',
    { timeZone: FUSEAU, day: '2-digit', month: '2-digit', year: 'numeric' },
  );

/** « 09h00 » */
export const heureFr = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString('fr-FR', {
      timeZone: FUSEAU,
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(':', 'h');

/** « aujourd'hui à 09h00 », « hier à 18h30 » ou « 12/10/2026 ». */
export function quandFr(iso: string, maintenant = new Date()): string {
  const jour = (d: Date) => d.toISOString().slice(0, 10);
  const veille = new Date(maintenant.getTime() - 86_400_000);
  if (jour(new Date(iso)) === jour(maintenant))
    return `aujourd'hui à ${heureFr(iso)}`;
  if (jour(new Date(iso)) === jour(veille)) return `hier à ${heureFr(iso)}`;
  return dateFr(iso);
}

/** « 25 000 FCFA » (espaces simples pour tous les téléphones). */
export const fcfa = (montant: number) =>
  `${String(montant).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

/** « 14,50 » ; « — » si absent. */
export const noteFr = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toFixed(2).replace('.', ',');

/** « 1er », « 5e » */
export const rangFr = (rang: number) => (rang === 1 ? '1er' : `${rang}e`);

/** Date du jour à Dakar (AAAA-MM-JJ), décalée de n jours. */
export const jourIso = (decalage = 0, maintenant = new Date()) =>
  new Date(maintenant.getTime() + decalage * 86_400_000)
    .toISOString()
    .slice(0, 10);

export const TYPES_NOTIFICATION: Record<
  TypeNotification,
  { libelle: string; icone: string }
> = {
  LIBERATION_ANTICIPEE: { libelle: 'Libération anticipée', icone: '🏃' },
  PAS_DE_COURS: { libelle: 'Pas de cours', icone: '🏫' },
  ABSENCE: { libelle: 'Absence', icone: '📋' },
  COMPORTEMENT: { libelle: 'Comportement', icone: '⭐' },
  RAPPEL_PAIEMENT: { libelle: 'Rappel de paiement', icone: '💳' },
  RETARD_PAIEMENT: { libelle: 'Retard de paiement', icone: '⏰' },
  RECU_PAIEMENT: { libelle: 'Paiement', icone: '🧾' },
  RESULTATS: { libelle: 'Résultats', icone: '📊' },
  DECISION_FIN_ANNEE: { libelle: "Fin d'année", icone: '🎓' },
  EVENEMENT: { libelle: 'Événement', icone: '📅' },
  USAGE_APPAREIL: { libelle: 'Appareil en classe', icone: '📱' },
  APPAREIL: { libelle: 'Appareil', icone: '📱' },
};

/** Écran de l'application lié à une notification (ex. événement auquel répondre). */
export function lienNotification(n: Notification): string | null {
  if (n.type === 'EVENEMENT' && n.sourceId) return `/evenement/${n.sourceId}`;
  switch (n.type) {
    case 'RESULTATS':
    case 'DECISION_FIN_ANNEE':
      return '/resultats';
    case 'COMPORTEMENT':
      return '/comportement';
    case 'RAPPEL_PAIEMENT':
    case 'RETARD_PAIEMENT':
    case 'RECU_PAIEMENT':
      return '/paiements';
    case 'ABSENCE':
      return '/absences';
    case 'APPAREIL':
    case 'USAGE_APPAREIL':
      return '/appareils';
    default:
      return null;
  }
}

/** Cache hors ligne : les plus récentes d'abord, sans doublon, 50 au plus. */
export function fusionnerNotifications(
  nouvelles: Notification[],
  anciennes: Notification[],
  max = 50,
): Notification[] {
  const vues = new Set<string>();
  return [...nouvelles, ...anciennes]
    .filter((n) => (vues.has(n.id) ? false : (vues.add(n.id), true)))
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
    .slice(0, max);
}

/**
 * Code lu sur une étiquette : l'URL complète (…/appareils/scan/<code>) ou le
 * code court à 8 caractères saisi à la main.
 */
export function codeEtiquette(lu: string): string | null {
  const texte = lu.trim();
  const url = /\/appareils\/scan\/([^/?#\s]+)/.exec(texte);
  if (url) return decodeURIComponent(url[1]).toLowerCase();
  if (/^[0-9a-z-]{8,}$/i.test(texte)) return texte.toLowerCase();
  return null;
}

export const LIBELLES_TYPE_APPAREIL = {
  TELEPHONE: 'Téléphone',
  TABLETTE: 'Tablette',
  ORDINATEUR: 'Ordinateur',
  AUTRE: 'Appareil',
} as const;

export const LIBELLES_STATUT_APPAREIL: Record<StatutAppareil, string> = {
  ACTIF: 'En service',
  PERDU: 'Perdu',
  TROUVE: 'Trouvé',
  CONFISQUE: 'Confisqué',
  RESTITUE: 'Restitué',
};

export const LIBELLES_SIGNALEMENT: Record<TypeSignalement, string> = {
  DECLARE_PERDU: 'Déclarer perdu',
  TROUVE: 'Signaler trouvé',
  CONFISQUE: 'Confisquer',
  RESTITUE: 'Restituer',
  USAGE_EN_CLASSE: 'Usage en classe',
};

/** « Téléphone Tecno Spark 20 bleu » */
export const designationAppareil = (a: Appareil) =>
  [LIBELLES_TYPE_APPAREIL[a.type], a.marque, a.modele, a.couleur]
    .filter(Boolean)
    .join(' ');

/** Même règle que l'API (qui reste seule juge) : évite de proposer un choix voué à l'échec. */
const REGLES_SIGNALEMENT: Record<
  TypeSignalement,
  { depuis: StatutAppareil[]; roles: Role[] }
> = {
  DECLARE_PERDU: {
    depuis: ['ACTIF', 'RESTITUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'SURVEILLANT', 'PARENT'],
  },
  TROUVE: {
    depuis: ['ACTIF', 'PERDU', 'RESTITUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'ENSEIGNANT', 'SURVEILLANT', 'COMPTABLE'],
  },
  CONFISQUE: {
    depuis: ['ACTIF', 'RESTITUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'ENSEIGNANT', 'SURVEILLANT'],
  },
  RESTITUE: {
    depuis: ['PERDU', 'TROUVE', 'CONFISQUE'],
    roles: ['ADMIN', 'SECRETARIAT', 'SURVEILLANT'],
  },
  USAGE_EN_CLASSE: {
    depuis: ['ACTIF', 'RESTITUE'],
    roles: ['ADMIN', 'ENSEIGNANT', 'SURVEILLANT'],
  },
};

export const signalementsPossibles = (role: Role, statut: StatutAppareil) =>
  (Object.keys(REGLES_SIGNALEMENT) as TypeSignalement[]).filter(
    (t) =>
      REGLES_SIGNALEMENT[t].roles.includes(role) &&
      REGLES_SIGNALEMENT[t].depuis.includes(statut),
  );

export const CATEGORIES_COMPORTEMENT = {
  POSITIF: [
    ['FELICITATIONS', 'Félicitations'],
    ['ENCOURAGEMENT', 'Encouragements'],
  ],
  NEGATIF: [
    ['RETARD', 'Retards répétés'],
    ['INDISCIPLINE', 'Indiscipline'],
    ['FRAUDE', 'Fraude'],
    ['VIOLENCE', 'Violence'],
    ['USAGE_APPAREIL', "Usage d'un appareil"],
    ['AUTRE', 'Autre'],
  ],
} as const;

export const LIBELLES_CATEGORIE: Record<string, string> = Object.fromEntries([
  ...CATEGORIES_COMPORTEMENT.POSITIF,
  ...CATEGORIES_COMPORTEMENT.NEGATIF,
  ['ABSENCE', 'Absence'],
]);

/** Le numéro saisi par le parent, ramené au format international (Sénégal par défaut). */
export function telephoneE164(saisie: string): string {
  let n = saisie.replace(/[\s.()-]/g, '');
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  if (/^\d{9}$/.test(n)) n = `+221${n}`;
  else if (/^221\d{9}$/.test(n)) n = `+${n}`;
  return n;
}
