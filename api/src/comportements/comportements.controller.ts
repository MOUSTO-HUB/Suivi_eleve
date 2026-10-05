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
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import {
  FiltreComportementsDto,
  RejeterComportementDto,
  SignalerComportementDto,
} from './comportements.dto.js';
import { ComportementsService } from './comportements.service.js';

/** Signalent : enseignants, vie scolaire, direction. */
const SIGNALEMENT = [...GESTION_SCOLARITE, Role.ENSEIGNANT, Role.SURVEILLANT];

@Controller('comportements')
export class ComportementsController {
  constructor(private readonly comportements: ComportementsService) {}

  @Get()
  @Roles(...PERSONNEL, Role.PARENT)
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreComportementsDto,
  ) {
    return this.comportements.lister(u, filtre);
  }

  @Get(':id')
  @Roles(...PERSONNEL, Role.PARENT)
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comportements.detail(u, id);
  }

  @Post()
  @Roles(...SIGNALEMENT)
  signaler(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: SignalerComportementDto,
  ) {
    return this.comportements.signaler(u, dto);
  }

  /** Cas grave : la direction valide (la famille est prévenue) ou refuse. */
  @Post(':id/valider')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  valider(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comportements.valider(u, id);
  }

  @Post(':id/rejeter')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  rejeter(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeterComportementDto,
  ) {
    return this.comportements.rejeter(u, id, dto);
  }

  @Delete(':id')
  @Roles(...GESTION_SCOLARITE)
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.comportements.supprimer(u, id);
  }
}
