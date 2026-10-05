// Règles des annonces « pas de cours » et « libération anticipée » (EF-20 à EF-32), sans base.
import { MotifAnnonce, TypeAnnonce } from '../generated/prisma/enums.js';

/**
 * Heures saisies et affichées à l'heure de Dakar (UTC+0, sans heure d'été) :
 * « 11:30 » le 07/10/2026 est donc stocké 2026-10-07T11:30:00Z.
 */
export const FUSEAU = 'Africa/Dakar';

export const LIBELLES_MOTIF: Record<MotifAnnonce, string> = {
  GREVE: 'grève',
  COUPURE_ELECTRICITE: "coupure d'électricité",
  INTEMPERIES: 'intempéries',
  ABSENCE_ENSEIGNANT: "absence d'enseignant",
  AUTRE: 'autre motif',
};

/** Motif lu par les familles ; « Autre » est remplacé par la précision saisie. */
export function motifTexte(
  motif: MotifAnnonce,
  detail?: string | null,
): string {
  if (motif === MotifAnnonce.AUTRE)
    return detail?.trim() || LIBELLES_MOTIF.AUTRE;
  return LIBELLES_MOTIF[motif];
}

/** « 2026-10-07 » + « 11:30 » → instant correspondant à Dakar. */
export function instantDakar(jour: string, heure = '00:00'): Date {
  return new Date(`${jour}T${heure}:00.000Z`);
}

const formatJour = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const formatHeure = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  hour: '2-digit',
  minute: '2-digit',
});

/** « 07/10/2026 » */
export const jourFr = (date: Date) => formatJour.format(date);

/** « 11h30 » */
export const heureFr = (date: Date) =>
  formatHeure.format(date).replace(':', 'h');

export function titreAnnonce(
  type: TypeAnnonce,
  dateDebut: Date,
  classes: string[] | null,
): string {
  const qui = classes?.length ? classes.join(', ') : 'toute l’école';
  return type === TypeAnnonce.LIBERATION_ANTICIPEE
    ? `Libération anticipée à ${heureFr(dateDebut)} – ${qui}`
    : `Pas de cours le ${jourFr(dateDebut)} – ${qui}`;
}

/** Variables des modèles de messages pour cette annonce. */
export function variablesAnnonce(annonce: {
  dateDebut: Date;
  creneau: string | null;
  motif: MotifAnnonce | null;
  motifDetail: string | null;
  message: string;
}): Record<string, string> {
  return {
    date: jourFr(annonce.dateDebut),
    heure: heureFr(annonce.dateDebut),
    creneau: annonce.creneau ?? '',
    motif: annonce.motif ? motifTexte(annonce.motif, annonce.motifDetail) : '',
    // Complément libre, ajouté en fin d'email et dans l'application.
    details: annonce.message ? `\n\n${annonce.message}` : '',
  };
}

/** Délai minimal entre la saisie et un envoi programmé. */
export const AVANCE_MIN_MS = 60 * 1000;

/** Message d'erreur si la programmation est impossible, sinon null. */
export function erreurProgrammation(
  programmeeLe: Date,
  maintenant = new Date(),
): string | null {
  if (Number.isNaN(programmeeLe.getTime())) return "Date d'envoi invalide.";
  if (programmeeLe.getTime() < maintenant.getTime() + AVANCE_MIN_MS) {
    return "L'envoi programmé doit être dans au moins une minute ; sinon, choisissez l'envoi immédiat.";
  }
  if (programmeeLe.getTime() > maintenant.getTime() + 60 * 24 * 3600 * 1000) {
    return "L'envoi ne peut pas être programmé à plus de 60 jours.";
  }
  return null;
}
