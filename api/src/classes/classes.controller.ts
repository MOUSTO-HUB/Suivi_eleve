import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import {
  CreerClasseDto,
  FiltreClassesDto,
  ModifierClasseDto,
} from './classes.dto.js';
import { ClassesService } from './classes.service.js';

@Controller('classes')
@Roles(...PERSONNEL)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreClassesDto,
  ) {
    return this.classes.lister(u, filtre);
  }

  @Get(':id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.classes.detail(u, id);
  }

  @Post()
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerClasseDto,
  ) {
    return this.classes.creer(u, dto);
  }

  @Patch(':id')
  @Roles(...GESTION_SCOLARITE)
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierClasseDto,
  ) {
    return this.classes.modifier(u, id, dto);
  }
}
