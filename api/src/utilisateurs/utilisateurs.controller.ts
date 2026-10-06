import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import {
  ChangerMotDePasseDto,
  CreerUtilisateurDto,
  ModifierUtilisateurDto,
} from './utilisateurs.dto.js';
import { UtilisateursService } from './utilisateurs.service.js';

/** Comptes du personnel : gérés par la direction. */
@Controller('utilisateurs')
@Roles(Role.ADMIN)
export class UtilisateursController {
  constructor(private readonly utilisateurs: UtilisateursService) {}

  @Get()
  lister(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.utilisateurs.lister(u);
  }

  /** Renvoie une seule fois le mot de passe provisoire à transmettre à la personne. */
  @Post()
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerUtilisateurDto,
  ) {
    return this.utilisateurs.creer(u, dto);
  }

  @Patch(':id')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierUtilisateurDto,
  ) {
    return this.utilisateurs.modifier(u, id, dto);
  }

  @Post(':id/reinitialiser-mot-de-passe')
  @HttpCode(200)
  reinitialiser(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utilisateurs.reinitialiser(u, id);
  }

  /** Tout le personnel, et le concepteur : changer son propre mot de passe. */
  @Post('moi/mot-de-passe')
  @Roles(...PERSONNEL, Role.SUPER_ADMIN)
  @HttpCode(204)
  async changerMotDePasse(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ChangerMotDePasseDto,
  ) {
    await this.utilisateurs.changerMotDePasse(u, dto.actuel, dto.nouveau);
  }
}
