import { MODELES_PAR_DEFAUT } from '../notifications/modeles.defaut.js';
import { preparerSms, rendre } from '../notifications/notifications.regles.js';
import {
  quandFr,
  reponseRetenue,
  typeDocument,
  variablesEvenement,
  veilleA18h,
} from './evenements.regles.js';

const debut = new Date('2026-11-15T09:00:00Z');
const evenement = {
  titre: 'Kermesse de fin de trimestre',
  message: 'Jeux, stands et spectacle des élèves.',
  dateDebut: debut,
  dateFin: null,
  lieu: "cour de l'école",
  modalites: 'Entrée libre ; tenue de sport conseillée.',
  question: 'Votre enfant participera-t-il au spectacle ?',
  pieceJointeUrl: 'evenements/x.pdf',
};

describe('événements', () => {
  it('programme le rappel la veille à 18h', () => {
    expect(veilleA18h(debut).toISOString()).toBe('2026-11-14T18:00:00.000Z');
    expect(veilleA18h(new Date('2026-12-01T07:30:00Z')).toISOString()).toBe(
      '2026-11-30T18:00:00.000Z',
    );
  });

  it('indique la date, sur un ou plusieurs jours', () => {
    expect(quandFr(debut, null)).toBe('15/11/2026 à 09h00');
    expect(quandFr(debut, new Date('2026-11-15T17:00:00Z'))).toBe(
      '15/11/2026 à 09h00',
    );
    expect(quandFr(debut, new Date('2026-11-17T12:00:00Z'))).toBe(
      '15/11/2026 à 09h00 au 17/11/2026',
    );
  });

  it('rédige publication, rappel et annulation', () => {
    const publication = variablesEvenement(evenement, 'publication');
    expect(publication.details).toBe(
      [
        'Jeux, stands et spectacle des élèves.',
        'Modalités : Entrée libre ; tenue de sport conseillée.',
        'Un document est joint, à consulter dans l’application.',
        "Merci de répondre dans l'application : Votre enfant participera-t-il au spectacle ?",
      ].join('\n\n'),
    );
    expect(variablesEvenement(evenement, 'rappel').titre).toBe(
      'Rappel, demain : Kermesse de fin de trimestre',
    );
    expect(variablesEvenement(evenement, 'annulation').details).toBe(
      "L'événement « Kermesse de fin de trimestre » prévu le 15/11/2026 à 09h00 est annulé.",
    );
    const sms = preparerSms(
      rendre(MODELES_PAR_DEFAUT.EVENEMENT.SMS.contenu, publication),
    );
    expect(sms).toBe(
      "Suivi_eleve : Kermesse de fin de trimestre le 15/11/2026 à 09h00 (cour de l'école). Détails dans l'application.",
    );
  });

  it('reconnaît un PDF ou une image', () => {
    expect(typeDocument(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(typeDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(typeDocument(Buffer.from('<html>'))).toBeNull();
  });

  it('retient la réponse la plus récente des tuteurs', () => {
    const oui = { reponse: true, modifieLe: new Date('2026-11-10T10:00:00Z') };
    const non = { reponse: false, modifieLe: new Date('2026-11-11T08:00:00Z') };
    expect(reponseRetenue([oui, non])).toBe(non);
    expect(reponseRetenue([])).toBeNull();
  });
});
