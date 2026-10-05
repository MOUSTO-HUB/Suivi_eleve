import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { RequeteAuthentifiee } from '../auth.types.js';
import { CLE_PARAM_ELEVE } from '../decorators/param-eleve.decorator.js';

/**
 * Refuse à un PARENT l'accès à un élève qui ne lui est pas rattaché.
 * À poser avec @UseGuards(ParentOwnsEleveGuard) sur les routes qui portent un id d'élève.
 * Le personnel passe : ses droits sont réglés par @Roles et le filtrage par école.
 */
@Injectable()
export class ParentOwnsEleveGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requete = ctx.switchToHttp().getRequest<RequeteAuthentifiee>();
    const { utilisateur } = requete;
    if (!utilisateur) throw new UnauthorizedException();
    if (utilisateur.role !== Role.PARENT) return true;

    const nomParam =
      this.reflector.getAllAndOverride<string | undefined>(CLE_PARAM_ELEVE, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? 'eleveId';
    // Express 5 type les paramètres en string | string[] (routes génériques).
    const valeur = requete.params[nomParam];
    const eleveId = typeof valeur === 'string' ? valeur : undefined;

    const lien =
      eleveId && utilisateur.tuteurId
        ? await this.prisma.eleveTuteur.findUnique({
            where: {
              eleveId_tuteurId: { eleveId, tuteurId: utilisateur.tuteurId },
            },
            select: { eleveId: true },
          })
        : null;

    if (!lien) {
      throw new ForbiddenException(
        "Cet élève n'est pas rattaché à votre compte.",
      );
    }
    return true;
  }
}
