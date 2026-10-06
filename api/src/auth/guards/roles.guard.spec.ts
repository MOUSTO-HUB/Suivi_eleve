import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums.js';
import type { UtilisateurConnecte } from '../auth.types.js';
import { OuvertAuConcepteur } from '../decorators/ouvert-au-concepteur.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { contexteHttp } from './contexte.test-utils.js';
import { RolesGuard } from './roles.guard.js';

class Controleur {
  libre() {}

  @Roles(Role.ADMIN, Role.COMPTABLE)
  finances() {}

  @OuvertAuConcepteur()
  monProfil() {}

  @Roles(Role.SUPER_ADMIN)
  ecoles() {}
}

const utilisateur = (role: Role): UtilisateurConnecte => ({
  id: 'u1',
  role,
  ecoleId: 'e1',
  tuteurId: null,
});

describe('RolesGuard', () => {
  const garde = new RolesGuard(new Reflector());

  it('laisse passer tout utilisateur connecté quand la route n’a pas de @Roles', () => {
    const ctx = contexteHttp(
      { utilisateur: utilisateur(Role.PARENT) },
      Controleur,
      'libre',
    );
    expect(garde.canActivate(ctx)).toBe(true);
  });

  it('laisse passer un rôle autorisé', () => {
    const ctx = contexteHttp(
      { utilisateur: utilisateur(Role.COMPTABLE) },
      Controleur,
      'finances',
    );
    expect(garde.canActivate(ctx)).toBe(true);
  });

  it('refuse un rôle non autorisé', () => {
    const ctx = contexteHttp(
      { utilisateur: utilisateur(Role.ENSEIGNANT) },
      Controleur,
      'finances',
    );
    expect(() => garde.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('refuse une requête sans utilisateur sur une route restreinte', () => {
    const ctx = contexteHttp({}, Controleur, 'finances');
    expect(() => garde.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('applique un @Roles posé sur le contrôleur', () => {
    @Roles(Role.ADMIN)
    class ControleurAdmin {
      route() {}
    }
    const refuse = contexteHttp(
      { utilisateur: utilisateur(Role.SECRETARIAT) },
      ControleurAdmin,
      'route',
    );
    expect(() => garde.canActivate(refuse)).toThrow(ForbiddenException);
  });

  describe('concepteur (SUPER_ADMIN, sans école)', () => {
    const concepteur = { ...utilisateur(Role.SUPER_ADMIN), ecoleId: '' };
    const essai = (methode: string) => () =>
      garde.canActivate(
        contexteHttp({ utilisateur: concepteur }, Controleur, methode),
      );

    it('entre sur ses routes et sur son profil', () => {
      expect(essai('ecoles')()).toBe(true);
      expect(essai('monProfil')()).toBe(true);
    });

    it('est refusé sur toute route des écoles, même sans @Roles', () => {
      expect(essai('libre')).toThrow(ForbiddenException);
      expect(essai('finances')).toThrow(ForbiddenException);
    });

    it('la direction d’une école est refusée sur les routes du concepteur', () => {
      const ctx = contexteHttp(
        { utilisateur: utilisateur(Role.ADMIN) },
        Controleur,
        'ecoles',
      );
      expect(() => garde.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
