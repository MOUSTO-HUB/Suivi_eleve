import { MethodeDoubleAuth, Role } from '../generated/prisma/enums.js';
import {
  doubleAuthObligatoire,
  dureeLisible,
  emailMasque,
  methodeDoubleAuth,
  quiReactive,
  sanction,
} from './connexion.regles.js';

describe('blocage progressif', () => {
  it('30 minutes, puis 3 heures, puis désactivation', () => {
    expect(sanction(1)).toEqual({ type: 'blocage', dureeMs: 30 * 60_000 });
    expect(sanction(2)).toEqual({ type: 'blocage', dureeMs: 3 * 3_600_000 });
    expect(sanction(3)).toEqual({ type: 'desactivation' });
    expect(sanction(4)).toEqual({ type: 'desactivation' });
  });

  it('écrit les durées en clair', () => {
    expect(dureeLisible(30 * 60_000)).toBe('30 minutes');
    expect(dureeLisible(3 * 3_600_000)).toBe('3 heures');
    expect(dureeLisible(65 * 60_000)).toBe('1 heure et 5 minutes');
    expect(dureeLisible(10_000)).toBe('1 minute');
  });

  it('dit qui réactive le compte', () => {
    expect(quiReactive(Role.ENSEIGNANT)).toContain('direction');
    expect(quiReactive(Role.ADMIN)).toContain('concepteur');
    expect(quiReactive(Role.SUPER_ADMIN)).toContain('serveur');
  });
});

describe('double authentification', () => {
  it('obligatoire pour la direction, la comptabilité et le concepteur', () => {
    expect(doubleAuthObligatoire(Role.ADMIN)).toBe(true);
    expect(doubleAuthObligatoire(Role.COMPTABLE)).toBe(true);
    expect(doubleAuthObligatoire(Role.SUPER_ADMIN)).toBe(true);
    expect(doubleAuthObligatoire(Role.ENSEIGNANT)).toBe(false);
    expect(doubleAuthObligatoire(Role.SECRETARIAT)).toBe(false);
  });

  it('email par défaut pour les rôles obligés, sinon le choix de la personne', () => {
    expect(methodeDoubleAuth({ role: Role.ADMIN, doubleAuth: null })).toBe(
      MethodeDoubleAuth.EMAIL,
    );
    expect(
      methodeDoubleAuth({
        role: Role.ADMIN,
        doubleAuth: MethodeDoubleAuth.APPLICATION,
      }),
    ).toBe(MethodeDoubleAuth.APPLICATION);
    expect(
      methodeDoubleAuth({ role: Role.SURVEILLANT, doubleAuth: null }),
    ).toBeNull();
  });

  it("masque l'adresse email", () => {
    expect(emailMasque('direction@ecole.sn')).toBe('d••••••••@ecole.sn');
    expect(emailMasque('ab@x.sn')).toBe('a•••@x.sn');
  });
});
