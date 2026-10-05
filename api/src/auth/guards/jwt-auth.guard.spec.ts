import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../generated/prisma/enums.js';
import type { RequeteAuthentifiee } from '../auth.types.js';
import { Public } from '../decorators/public.decorator.js';
import { contexteHttp } from './contexte.test-utils.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({
    secret: 'secret-de-test-assez-long-pour-hs256!!',
  });
  const garde = new JwtAuthGuard(jwt, new Reflector());

  it('laisse passer une route @Public() sans jeton', async () => {
    class Controleur {
      @Public()
      route() {}
    }
    const ctx = contexteHttp({}, Controleur, 'route');
    await expect(garde.canActivate(ctx)).resolves.toBe(true);
  });

  it('refuse une requête sans jeton', async () => {
    await expect(garde.canActivate(contexteHttp({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const faux = await new JwtService({
      secret: 'un-autre-secret-de-test-tout-aussi-long',
    }).signAsync({ sub: 'u1', role: Role.ADMIN, ecoleId: 'e1' });
    const ctx = contexteHttp({ headers: { authorization: `Bearer ${faux}` } });
    await expect(garde.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('refuse un jeton expiré', async () => {
    const expire = await jwt.signAsync(
      { sub: 'u1', role: Role.ADMIN, ecoleId: 'e1' },
      { expiresIn: -10 },
    );
    const ctx = contexteHttp({
      headers: { authorization: `Bearer ${expire}` },
    });
    await expect(garde.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("attache l'utilisateur à la requête quand le jeton est valide", async () => {
    const jeton = await jwt.signAsync({
      sub: 'u1',
      role: Role.PARENT,
      ecoleId: 'e1',
      tuteurId: 't1',
    });
    const ctx = contexteHttp({ headers: { authorization: `Bearer ${jeton}` } });

    await expect(garde.canActivate(ctx)).resolves.toBe(true);
    const requete = ctx.switchToHttp().getRequest<RequeteAuthentifiee>();
    expect(requete.utilisateur).toEqual({
      id: 'u1',
      role: Role.PARENT,
      ecoleId: 'e1',
      tuteurId: 't1',
    });
  });
});
