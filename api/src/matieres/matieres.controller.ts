import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import {
  CreerMatiereDto,
  EnseignementsDto,
  FiltrePersonnelDto,
  ModifierMatiereDto,
} from './matieres.dto.js';
import { MatieresService } from './matieres.service.js';

@Controller()
@Roles(...PERSONNEL)
export class MatieresController {
  constructor(private readonly matieres: MatieresService) {}

  @Get('matieres')
  lister(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.matieres.lister(u);
  }

  @Post('matieres')
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerMatiereDto,
  ) {
    return this.matieres.creer(u, dto);
  }

  @Patch('matieres/:id')
  @Roles(...GESTION_SCOLARITE)
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierMatiereDto,
  ) {
    return this.matieres.modifier(u, id, dto);
  }

  @Get('classes/:id/enseignements')
  enseignements(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matieres.enseignements(u, id);
  }

  @Put('classes/:id/enseignements')
  @Roles(...GESTION_SCOLARITE)
  definirEnseignements(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnseignementsDto,
  ) {
    return this.matieres.definirEnseignements(u, id, dto);
  }

  @Get('personnel')
  @Roles(...GESTION_SCOLARITE)
  personnel(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltrePersonnelDto,
  ) {
    return this.matieres.personnel(u, filtre.role);
  }
}
