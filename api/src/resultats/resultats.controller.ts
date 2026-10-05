import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { ParentOwnsEleveGuard } from '../auth/guards/parent-owns-eleve.guard.js';
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import { bulletinPdf } from './bulletin.js';
import {
  ClasseDto,
  ClassePeriodeDto,
  DecisionsDto,
  MoyennesMatiereDto,
  ResultatsGenerauxDto,
} from './resultats.dto.js';
import { ResultatsService } from './resultats.service.js';

/** Saisissent : direction, secrétariat, enseignants (droits précisés matière par matière). */
const SAISIE = [...GESTION_SCOLARITE, Role.ENSEIGNANT];

@Controller('resultats')
export class ResultatsController {
  constructor(private readonly resultats: ResultatsService) {}

  @Get('periodes')
  @Roles(...PERSONNEL, Role.PARENT)
  periodes(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.resultats.periodes(u);
  }

  /** Classes et matières dont l'utilisateur saisit les moyennes. */
  @Get('mes-saisies')
  @Roles(...SAISIE)
  mesSaisies(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.resultats.mesSaisies(u);
  }

  @Get('saisie')
  @Roles(...SAISIE)
  saisie(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() q: ClassePeriodeDto,
  ) {
    return this.resultats.saisie(u, q.classeId, q.periodeId);
  }

  /** Moyennes d'une matière : professeur de la matière (ou direction, secrétariat). */
  @Put('moyennes')
  @Roles(...SAISIE)
  enregistrerMoyennes(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: MoyennesMatiereDto,
  ) {
    return this.resultats.enregistrerMoyennes(u, dto);
  }

  /** Moyenne générale, rang, appréciation : professeur principal (ou direction, secrétariat). */
  @Put('generaux')
  @Roles(...SAISIE)
  enregistrerGeneraux(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ResultatsGenerauxDto,
  ) {
    return this.resultats.enregistrerGeneraux(u, dto);
  }

  /** Publication par la direction : les familles sont prévenues (EF-42). */
  @Post('publier')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  publier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ClassePeriodeDto,
  ) {
    return this.resultats.publier(u, dto.classeId, dto.periodeId);
  }

  @Get('decisions')
  @Roles(...SAISIE)
  decisions(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() q: ClasseDto,
  ) {
    return this.resultats.decisions(u, q.classeId);
  }

  @Put('decisions')
  @Roles(...SAISIE)
  enregistrerDecisions(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: DecisionsDto,
  ) {
    return this.resultats.enregistrerDecisions(u, dto);
  }

  @Post('decisions/publier')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  publierDecisions(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ClasseDto,
  ) {
    return this.resultats.publierDecisions(u, dto.classeId);
  }

  /** Résultats d'un élève ; un parent ne voit que les siens, et seulement publiés. */
  @Get('eleves/:eleveId')
  @Roles(...PERSONNEL, Role.PARENT)
  @UseGuards(ParentOwnsEleveGuard)
  resultatsEleve(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('eleveId', ParseUUIDPipe) eleveId: string,
  ) {
    return this.resultats.resultatsEleve(u, eleveId);
  }

  @Get('eleves/:eleveId/bulletins/:periodeId')
  @Roles(...PERSONNEL, Role.PARENT)
  @UseGuards(ParentOwnsEleveGuard)
  async bulletin(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('eleveId', ParseUUIDPipe) eleveId: string,
    @Param('periodeId', ParseUUIDPipe) periodeId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const donnees = await this.resultats.donneesBulletin(u, eleveId, periodeId);
    const nom = `bulletin-${donnees.eleve.matricule}-${donnees.periode}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9-]+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nom}.pdf"`);
    return new StreamableFile(await bulletinPdf(donnees));
  }
}
