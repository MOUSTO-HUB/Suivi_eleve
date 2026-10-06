import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums.js';
import type { RequeteAuthentifiee } from '../auth.types.js';
import { CLE_OUVERT_AU_CONCEPTEUR } from '../decorators/ouvert-au-concepteur.decorator.js';
import { CLE_ROLES } from '../decorators/roles.decorator.js';

/**
 * Garde global : applique @Roles(...). Sans @Roles, tout utilisateur connecté
 * d'une école passe. Le concepteur (SUPER_ADMIN, sans école) n'entre que sur
 * les routes qui le nomment dans @Roles ou portent @OuvertAuConcepteur() :
 * jamais sur les données d'une école.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const cibles = [ctx.getHandler(), ctx.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      CLE_ROLES,
      cibles,
    );
    const { utilisateur } = ctx
      .switchToHttp()
      .getRequest<RequeteAuthentifiee>();

    if (utilisateur?.role === Role.SUPER_ADMIN) {
      const ouvert = this.reflector.getAllAndOverride<boolean>(
        CLE_OUVERT_AU_CONCEPTEUR,
        cibles,
      );
      if (ouvert || roles?.includes(Role.SUPER_ADMIN)) return true;
      throw new ForbiddenException(
        "L'espace concepteur n'a pas accès aux données des écoles.",
      );
    }

    if (!roles?.length) return true;
    if (!utilisateur || !roles.includes(utilisateur.role)) {
      throw new ForbiddenException(
        "Votre rôle ne permet pas d'accéder à cette ressource.",
      );
    }
    return true;
  }
}
