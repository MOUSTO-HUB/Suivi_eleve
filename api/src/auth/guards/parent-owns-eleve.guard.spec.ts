import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { UtilisateurConnecte } from '../auth.types.js';
import { ParamEleve } from '../decorators/param-eleve.decorator.js';
import { contexteHttp } from './contexte.test-utils.js';
import { ParentOwnsEleveGuard } from './parent-owns-eleve.guard.js';

// Le tuteur t1 est rattaché à l'élève e-1 uniquement.
const findUnique = vi.fn(
  ({
    where,
  }: {
    where: { eleveId_tuteurId: { eleveId: string; tuteurId: string } };
  }) =>
    Promise.resolve(
      where.eleveId_tuteurId.eleveId === 'e-1' &&
        where.eleveId_tuteurId.tuteurId === 't1'
        ? { eleveId: 'e-1' }
        : null,
    ),
);
const prisma = { eleveTuteur: { findUnique } } as unknown as PrismaService;

const parent: UtilisateurConnecte = {
  id: 'u-parent',
  role: Role.PARENT,
  ecoleId: 'ecole',
  tuteurId: 't1',
};

describe('ParentOwnsEleveGuard', () => {
  const garde = new ParentOwnsEleveGuard(prisma, new Reflector());

  beforeEach(() => {
    findUnique.mockClear();
  });

  it('laisse passer le personnel sans interroger la base', async () => {
    const ctx = contexteHttp({
      utilisateur: { ...parent, role: Role.SECRETARIAT, tuteurId: null },
      params: { eleveId: 'e-2' },
    });
    await expect(garde.canActivate(ctx)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('laisse passer un parent vers son propre enfant', async () => {
    const ctx = contexteHttp({
      utilisateur: parent,
      params: { eleveId: 'e-1' },
    });
    await expect(garde.canActivate(ctx)).resolves.toBe(true);
  });

  it("refuse un parent vers l'enfant d'une autre famille", async () => {
    const ctx = contexteHttp({
      utilisateur: parent,
      params: { eleveId: 'e-2' },
    });
    await expect(garde.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it("refuse un parent quand la route ne porte pas d'id d'élève", async () => {
    const ctx = contexteHttp({ utilisateur: parent, params: {} });
    await expect(garde.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('refuse un parent dont le jeton ne porte pas de tuteur', async () => {
    const ctx = contexteHttp({
      utilisateur: { ...parent, tuteurId: null },
      params: { eleveId: 'e-1' },
    });
    await expect(garde.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('lit le paramètre indiqué par @ParamEleve', async () => {
    class Controleur {
      @ParamEleve('id')
      fiche() {}
    }
    const autorise = contexteHttp(
      { utilisateur: parent, params: { id: 'e-1' } },
      Controleur,
      'fiche',
    );
    const refuse = contexteHttp(
      { utilisateur: parent, params: { id: 'e-2', eleveId: 'e-1' } },
      Controleur,
      'fiche',
    );
    await expect(garde.canActivate(autorise)).resolves.toBe(true);
    await expect(garde.canActivate(refuse)).rejects.toThrow(ForbiddenException);
  });

  it('refuse une requête non authentifiée', async () => {
    const ctx = contexteHttp({ params: { eleveId: 'e-1' } });
    await expect(garde.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
