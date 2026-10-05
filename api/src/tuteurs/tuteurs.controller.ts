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
  CreerTuteurDto,
  FiltreTuteursDto,
  ModifierTuteurDto,
} from './tuteurs.dto.js';
import { TuteursService } from './tuteurs.service.js';

@Controller('tuteurs')
@Roles(...PERSONNEL)
export class TuteursController {
  constructor(private readonly tuteurs: TuteursService) {}

  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreTuteursDto,
  ) {
    return this.tuteurs.lister(u, filtre);
  }

  @Get(':id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tuteurs.detail(u, id);
  }

  @Post()
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerTuteurDto,
  ) {
    return this.tuteurs.creer(u, dto);
  }

  @Patch(':id')
  @Roles(...GESTION_SCOLARITE)
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierTuteurDto,
  ) {
    return this.tuteurs.modifier(u, id, dto);
  }
}
