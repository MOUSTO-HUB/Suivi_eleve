import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums.js';
import type { UtilisateurConnecte } from '../auth.types.js';
import { Roles } from '../decorators/roles.decorator.js';
import { contexteHttp } from './contexte.test-utils.js';
import { RolesGuard } from './roles.guard.js';

class Controleur {
  libre() {}

  @Roles(Role.ADMIN, Role.COMPTABLE)
  finances() {}
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
});
