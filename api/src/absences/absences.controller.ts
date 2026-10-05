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
import { GESTION_SCOLARITE } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import {
  FiltreAbsencesDto,
  JustifierAbsenceDto,
  SignalerAbsencesDto,
} from './absences.dto.js';
import { AbsencesService } from './absences.service.js';

/** Font l'appel : enseignants, vie scolaire, direction. */
const APPEL = [...GESTION_SCOLARITE, Role.ENSEIGNANT, Role.SURVEILLANT];
/** Justifient ou corrigent : vie scolaire et direction. */
const VIE_SCOLAIRE = [...GESTION_SCOLARITE, Role.SURVEILLANT];

@Controller('absences')
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  /** Personnel : absences de l'école. Parent : celles de ses enfants. */
  @Get()
  @Roles(...APPEL, Role.COMPTABLE, Role.PARENT)
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreAbsencesDto,
  ) {
    return this.absences.lister(u, filtre);
  }

  /** Appel : enregistre les absents ; les familles des absents non justifiés sont prévenues. */
  @Post()
  @Roles(...APPEL)
  signaler(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: SignalerAbsencesDto,
  ) {
    return this.absences.signaler(u, dto);
  }

  @Post(':id/justifier')
  @Roles(...VIE_SCOLAIRE)
  @HttpCode(200)
  justifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JustifierAbsenceDto,
  ) {
    return this.absences.justifier(u, id, dto);
  }

  /** Motif transmis par la famille depuis l'application. */
  @Post(':id/justification-parent')
  @Roles(Role.PARENT)
  @HttpCode(200)
  justificationParent(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JustifierAbsenceDto,
  ) {
    return this.absences.justificationParent(u, id, dto);
  }

  @Delete(':id')
  @Roles(...VIE_SCOLAIRE)
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.absences.supprimer(u, id);
  }
}
