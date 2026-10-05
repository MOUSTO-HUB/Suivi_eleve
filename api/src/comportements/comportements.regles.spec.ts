import {
  CategorieComportement,
  Role,
  TypeComportement,
} from '../generated/prisma/enums.js';
import { preparerSms, rendre } from '../notifications/notifications.regles.js';
import { MODELES_PAR_DEFAUT } from '../notifications/modeles.defaut.js';
import {
  erreurComportement,
  messagesComportement,
  statutInitial,
} from './comportements.regles.js';

const { POSITIF, NEGATIF } = TypeComportement;
const C = CategorieComportement;

describe('comportements', () => {
  it('refuse une catégorie qui ne correspond pas au type', () => {
    expect(
      erreurComportement({ type: POSITIF, categorie: C.FELICITATIONS }),
    ).toBeNull();
    expect(
      erreurComportement({ type: NEGATIF, categorie: C.VIOLENCE, gravite: 3 }),
    ).toBeNull();
    expect(erreurComportement({ type: POSITIF, categorie: C.FRAUDE })).toMatch(
      /fraude/,
    );
    expect(
      erreurComportement({
        type: NEGATIF,
        categorie: C.ENCOURAGEMENT,
        gravite: 1,
      }),
    ).toMatch(/encouragements/);
    expect(
      erreurComportement({ type: NEGATIF, categorie: C.INDISCIPLINE }),
    ).toMatch(/gravité/);
  });

  it('fait valider les cas graves par la direction', () => {
    expect(statutInitial(NEGATIF, 3, Role.ENSEIGNANT)).toBe('EN_ATTENTE');
    expect(statutInitial(NEGATIF, 3, Role.SECRETARIAT)).toBe('EN_ATTENTE');
    expect(statutInitial(NEGATIF, 3, Role.ADMIN)).toBe('VALIDE');
    expect(statutInitial(NEGATIF, 2, Role.ENSEIGNANT)).toBe('VALIDE');
    expect(statutInitial(POSITIF, 1, Role.ENSEIGNANT)).toBe('VALIDE');
  });

  const date = new Date('2026-10-05T09:00:00Z');

  it('rédige les messages d’un comportement négatif avec convocation', () => {
    const m = messagesComportement('Awa', {
      type: NEGATIF,
      categorie: C.INDISCIPLINE,
      description: 'Insolence répétée envers un enseignant',
      sanction: 'Deux heures de retenue',
      convocationLe: new Date('2026-10-08T10:00:00Z'),
      date,
    });
    expect(m.resume).toBe(
      'Awa : indiscipline le 05/10. Convocation des parents le 08/10/2026 à 10h00.',
    );
    expect(m.details).toBe(
      [
        'Nous devons vous signaler un comportement de Awa le 05/10/2026 : indiscipline.',
        'Insolence répétée envers un enseignant.',
        'Sanction : Deux heures de retenue.',
        "Nous vous prions de vous présenter à l'école le 08/10/2026 à 10h00 pour un entretien.",
      ].join('\n\n'),
    );
  });

  it('rédige les messages de félicitations', () => {
    const m = messagesComportement('Ali', {
      type: POSITIF,
      categorie: C.FELICITATIONS,
      description: 'Premier au concours de lecture !',
      sanction: null,
      convocationLe: null,
      date,
    });
    expect(m.resume).toBe(
      "Félicitations pour Ali le 05/10. Détails dans l'application.",
    );
    expect(m.details).toContain('Premier au concours de lecture !');
  });

  it('tient dans un SMS, même avec un prénom long', () => {
    const { resume } = messagesComportement('Mame Diarra Bousso', {
      type: NEGATIF,
      categorie: C.USAGE_APPAREIL,
      description: 'x',
      sanction: null,
      convocationLe: new Date('2026-10-08T10:00:00Z'),
      date,
    });
    const sms = preparerSms(
      rendre(MODELES_PAR_DEFAUT.COMPORTEMENT.SMS.contenu, { resume }),
    );
    expect(sms.endsWith('...')).toBe(false);
  });
});
