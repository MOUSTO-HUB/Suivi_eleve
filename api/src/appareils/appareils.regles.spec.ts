import {
  Role,
  StatutAppareil,
  TypeIncidentAppareil,
} from '../generated/prisma/enums.js';
import {
  codeCourt,
  debutDuMois,
  erreurIncident,
  imeiValide,
  seuilAtteint,
} from './appareils.regles.js';

const { ACTIF, PERDU, TROUVE, CONFISQUE, RESTITUE } = StatutAppareil;
const T = TypeIncidentAppareil;

describe('erreurIncident', () => {
  it.each([
    [T.DECLARE_PERDU, ACTIF, Role.PARENT],
    [T.TROUVE, PERDU, Role.ENSEIGNANT],
    [T.TROUVE, ACTIF, Role.SURVEILLANT],
    [T.CONFISQUE, ACTIF, Role.ENSEIGNANT],
    [T.RESTITUE, CONFISQUE, Role.SURVEILLANT],
    [T.RESTITUE, TROUVE, Role.SECRETARIAT],
    [T.USAGE_EN_CLASSE, RESTITUE, Role.ENSEIGNANT],
  ])('autorise %s depuis %s pour %s', (type, statut, role) => {
    expect(erreurIncident(type, statut, role)).toBeNull();
  });

  it.each([
    [T.CONFISQUE, ACTIF, Role.PARENT, /rôle/],
    [T.TROUVE, ACTIF, Role.PARENT, /rôle/],
    [T.RESTITUE, CONFISQUE, Role.ENSEIGNANT, /rôle/],
    [T.USAGE_EN_CLASSE, ACTIF, Role.COMPTABLE, /rôle/],
    [T.DECLARE_PERDU, PERDU, Role.PARENT, /déclaré perdu/],
    [T.RESTITUE, ACTIF, Role.SURVEILLANT, /actif/],
    [T.CONFISQUE, CONFISQUE, Role.ENSEIGNANT, /confisqué/],
    [T.USAGE_EN_CLASSE, CONFISQUE, Role.ENSEIGNANT, /confisqué/],
  ])('refuse %s depuis %s pour %s', (type, statut, role, message) => {
    expect(erreurIncident(type, statut, role)).toMatch(message);
  });
});

describe('seuilAtteint', () => {
  it('se déclenche à partir du seuil, si rien n’a été créé ce mois-ci', () => {
    expect([1, 2, 3, 4].map((n) => seuilAtteint(n, 3, false))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('ne crée qu’un comportement par mois', () => {
    expect(seuilAtteint(4, 3, true)).toBe(false);
  });

  it('un seuil de 0 désactive la règle', () => {
    expect(seuilAtteint(5, 0, false)).toBe(false);
  });
});

describe('outils', () => {
  it('donne le premier jour du mois', () => {
    expect(debutDuMois(new Date('2026-10-31T23:00:00Z')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('vérifie la clé de Luhn d’un IMEI', () => {
    expect(imeiValide('490154203237518')).toBe(true);
    expect(imeiValide('490154203237519')).toBe(false);
    expect(imeiValide('49015420323751')).toBe(false);
  });

  it('extrait un code court lisible', () => {
    expect(codeCourt('01a10b74-d0c7-703f-8016-b78d85fb5e90')).toBe('85FB5E90');
  });
});
