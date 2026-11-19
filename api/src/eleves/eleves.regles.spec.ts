import { BadRequestException } from '@nestjs/common';
import { depuisJour } from '../common/dates.js';
import { LienTuteur } from '../generated/prisma/enums.js';
import {
  erreurDateChangementClasse,
  erreurDateNaissance,
  formaterMatricule,
  normaliserTuteurs,
} from './eleves.regles.js';

describe('formaterMatricule', () => {
  it('produit SE-AAAA-NNNN', () => {
    expect(formaterMatricule(2026, 1)).toBe('SE-2026-0001');
    expect(formaterMatricule(2026, 42)).toBe('SE-2026-0042');
    expect(formaterMatricule(2027, 9999)).toBe('SE-2027-9999');
  });

  it('dépasse 4 chiffres sans tronquer', () => {
    expect(formaterMatricule(2026, 10000)).toBe('SE-2026-10000');
  });
});

describe('erreurDateNaissance', () => {
  const aujourdHui = depuisJour('2026-10-05');

  it('accepte un âge scolaire', () => {
    expect(erreurDateNaissance('2014-03-15', aujourdHui)).toBeNull();
  });

  it('refuse une date inexistante', () => {
    expect(erreurDateNaissance('2014-02-30', aujourdHui)).toMatch(/invalide/);
    expect(erreurDateNaissance('2014-13-01', aujourdHui)).toMatch(/invalide/);
  });

  it('refuse un âge improbable', () => {
    expect(erreurDateNaissance('2025-06-01', aujourdHui)).toMatch(/improbable/);
    expect(erreurDateNaissance('1980-01-01', aujourdHui)).toMatch(/improbable/);
  });
});

describe('erreurDateChangementClasse', () => {
  const debut = depuisJour('2026-11-19');

  it('accepte le jour du début de la classe actuelle ou après', () => {
    expect(erreurDateChangementClasse('2026-11-19', debut)).toBeNull();
    expect(erreurDateChangementClasse('2026-12-01', debut)).toBeNull();
  });

  it('refuse une date antérieure au début de la classe actuelle', () => {
    expect(erreurDateChangementClasse('2026-11-02', debut)).toMatch(
      /ne peut pas précéder.*2026-11-19/,
    );
  });

  it('accepte toute date sans classe en cours', () => {
    expect(erreurDateChangementClasse('2020-01-01', null)).toBeNull();
  });

  it('refuse une date inexistante', () => {
    expect(erreurDateChangementClasse('2026-02-30', null)).toMatch(/invalide/);
  });
});

describe('normaliserTuteurs', () => {
  const pere = { contact1: '+221770000001', lien: LienTuteur.PERE };
  const mere = { contact1: '+221770000002', lien: LienTuteur.MERE };

  it('désigne le premier comme principal par défaut', () => {
    const [a, b] = normaliserTuteurs([pere, mere]);
    expect(a.principal).toBe(true);
    expect(b.principal).toBe(false);
  });

  it('garde le principal choisi', () => {
    const [a, b] = normaliserTuteurs([pere, { ...mere, principal: true }]);
    expect(a.principal).toBe(false);
    expect(b.principal).toBe(true);
  });

  it('refuse deux principaux', () => {
    expect(() =>
      normaliserTuteurs([
        { ...pere, principal: true },
        { ...mere, principal: true },
      ]),
    ).toThrow(BadRequestException);
  });

  it('refuse le même tuteur deux fois', () => {
    expect(() => normaliserTuteurs([pere, { ...pere }])).toThrow(
      BadRequestException,
    );
    expect(() =>
      normaliserTuteurs([
        { tuteurId: 'a', lien: LienTuteur.PERE },
        { tuteurId: 'a', lien: LienTuteur.AUTRE },
      ]),
    ).toThrow(BadRequestException);
  });
});
