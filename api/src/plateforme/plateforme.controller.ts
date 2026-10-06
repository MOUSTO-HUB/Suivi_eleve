import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CreerEcoleDto,
  FiltreEcolesDto,
  ModifierEcoleDto,
  PaiementAbonnementDto,
  SuspensionDto,
} from './plateforme.dto.js';
import { PlateformeService } from './plateforme.service.js';

/** Espace concepteur : réservé au SUPER_ADMIN (aucune donnée d'élève). */
@Controller('plateforme')
@Roles(Role.SUPER_ADMIN)
export class PlateformeController {
  constructor(private readonly plateforme: PlateformeService) {}

  /** Écoles par état d'abonnement, élèves et familles suivis, encaissements. */
  @Get('tableau-de-bord')
  tableauDeBord() {
    return this.plateforme.tableauDeBord();
  }

  @Get('ecoles')
  ecoles(@Query() filtre: FiltreEcolesDto) {
    return this.plateforme.listerEcoles(filtre);
  }

  @Get('ecoles/:id')
  ecole(@Param('id', ParseUUIDPipe) id: string) {
    return this.plateforme.detailEcole(id);
  }

  /** Nouvelle école et son compte de direction (mot de passe provisoire rendu une fois). */
  @Post('ecoles')
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerEcoleDto,
  ) {
    return this.plateforme.creerEcole(u, dto);
  }

  @Patch('ecoles/:id')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierEcoleDto,
  ) {
    return this.plateforme.modifierEcole(u, id, dto);
  }

  /** Paiement d'abonnement reçu : prolonge d'1 mois ou d'1 an. */
  @Post('ecoles/:id/paiements')
  payer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaiementAbonnementDto,
  ) {
    return this.plateforme.enregistrerPaiement(u, id, dto);
  }

  /** Annule le dernier paiement enregistré (erreur de saisie). */
  @Delete('ecoles/:id/paiements/:paiementId')
  annulerPaiement(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paiementId', ParseUUIDPipe) paiementId: string,
  ) {
    return this.plateforme.annulerDernierPaiement(u, id, paiementId);
  }

  @Post('ecoles/:id/suspendre')
  @HttpCode(200)
  suspendre(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspensionDto,
  ) {
    return this.plateforme.suspendre(u, id, dto.motif);
  }

  @Post('ecoles/:id/reactiver')
  @HttpCode(200)
  reactiver(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plateforme.reactiver(u, id);
  }

  /** Nouveau mot de passe provisoire pour un compte de direction. */
  @Post('ecoles/:id/direction/:utilisateurId/reinitialiser')
  @HttpCode(200)
  reinitialiserDirection(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('utilisateurId', ParseUUIDPipe) utilisateurId: string,
  ) {
    return this.plateforme.reinitialiserDirection(u, id, utilisateurId);
  }
}
