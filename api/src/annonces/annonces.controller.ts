import {
  Body,
  Controller,
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
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import { CreerAnnonceDto, FiltreAnnoncesDto } from './annonces.dto.js';
import { AnnoncesService } from './annonces.service.js';

@Controller('annonces')
@Roles(...PERSONNEL)
export class AnnoncesController {
  constructor(private readonly annonces: AnnoncesService) {}

  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreAnnoncesDto,
  ) {
    return this.annonces.lister(u, filtre);
  }

  @Get(':id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.annonces.detail(u, id);
  }

  /** Déclare une absence de cours ou une libération anticipée (envoi immédiat ou programmé). */
  @Post()
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerAnnonceDto,
  ) {
    return this.annonces.creer(u, dto);
  }

  @Post(':id/annuler')
  @Roles(...GESTION_SCOLARITE)
  @HttpCode(200)
  annuler(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.annonces.annuler(u, id);
  }

  @Post(':id/envoyer')
  @Roles(...GESTION_SCOLARITE)
  @HttpCode(200)
  envoyerMaintenant(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.annonces.envoyerMaintenant(u, id);
  }
}
