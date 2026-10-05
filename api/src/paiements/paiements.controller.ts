import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CreerRappelDto, FiltreRappelsDto } from './paiements.dto.js';
import { PaiementsService } from './paiements.service.js';

/** Le comptable signale ; la direction peut aussi le faire. */
const COMPTABILITE = [Role.COMPTABLE, Role.ADMIN];

@Controller('rappels-paiement')
export class PaiementsController {
  constructor(private readonly paiements: PaiementsService) {}

  @Get()
  @Roles(...COMPTABILITE, Role.SECRETARIAT, Role.PARENT)
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreRappelsDto,
  ) {
    return this.paiements.lister(u, filtre);
  }

  /** Signale un paiement en attente : la famille est prévenue aussitôt. */
  @Post()
  @Roles(...COMPTABILITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerRappelDto,
  ) {
    return this.paiements.creer(u, dto);
  }

  /** Relance, avec le retard recalculé. */
  @Post(':id/relancer')
  @Roles(...COMPTABILITE)
  @HttpCode(200)
  relancer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paiements.envoyer(u, id);
  }

  @Post(':id/regler')
  @Roles(...COMPTABILITE)
  @HttpCode(200)
  regler(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paiements.regler(u, id);
  }

  @Delete(':id')
  @Roles(...COMPTABILITE)
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.paiements.supprimer(u, id);
  }
}
