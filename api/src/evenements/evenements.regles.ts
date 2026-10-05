// Événements de l'école (EF-70 à EF-72), sans accès à la base.
import { heureFr, jourFr } from '../annonces/annonces.regles.js';
import { typeImage } from '../stockage/stockage.service.js';

/** Rappel automatique : la veille de l'événement à 18h00, heure de Dakar (UTC+0). */
export function veilleA18h(dateDebut: Date): Date {
  const veille = new Date(dateDebut);
  veille.setUTCDate(veille.getUTCDate() - 1);
  veille.setUTCHours(18, 0, 0, 0);
  return veille;
}

/** « 15/11/2026 à 09h00 » (ou « au 16/11/2026 » si l'événement dure plusieurs jours). */
export function quandFr(dateDebut: Date, dateFin: Date | null): string {
  const debut = `${jourFr(dateDebut)} à ${heureFr(dateDebut)}`;
  if (!dateFin || jourFr(dateFin) === jourFr(dateDebut)) return debut;
  return `${debut} au ${jourFr(dateFin)}`;
}

interface Evenement {
  titre: string;
  message: string;
  dateDebut: Date;
  dateFin: Date | null;
  lieu: string | null;
  modalites: string | null;
  question: string | null;
  pieceJointeUrl: string | null;
}

export type Moment = 'publication' | 'rappel' | 'annulation';

/** Variables des messages : publication, rappel de la veille ou annulation. */
export function variablesEvenement(
  e: Evenement,
  moment: Moment,
): Record<string, string> {
  const quand = quandFr(e.dateDebut, e.dateFin);
  if (moment === 'annulation') {
    return {
      titre: `Annulé : ${e.titre}`,
      date: quand,
      lieu: e.lieu ?? '',
      details: `L'événement « ${e.titre} » prévu le ${quand} est annulé.`,
    };
  }
  return {
    titre: moment === 'rappel' ? `Rappel, demain : ${e.titre}` : e.titre,
    date: quand,
    lieu: e.lieu ?? '',
    details: [
      e.message,
      e.modalites ? `Modalités : ${e.modalites}` : null,
      e.pieceJointeUrl
        ? 'Un document est joint, à consulter dans l’application.'
        : null,
      e.question
        ? `Merci de répondre dans l'application : ${e.question}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

/** Pièce jointe : un PDF ou une image, reconnus à leurs premiers octets. */
export function typeDocument(contenu: Buffer) {
  if (contenu.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf' as const;
  }
  return typeImage(contenu);
}

export const EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

/** Réponse retenue pour un élève : la plus récente de ses tuteurs. */
export function reponseRetenue<T extends { reponse: boolean; modifieLe: Date }>(
  reponses: T[],
): T | null {
  return reponses.reduce<T | null>(
    (dernier, r) => (!dernier || r.modifieLe > dernier.modifieLe ? r : dernier),
    null,
  );
}
