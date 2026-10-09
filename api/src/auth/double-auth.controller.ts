import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import type { UtilisateurConnecte } from './auth.types.js';
import { Roles } from './decorators/roles.decorator.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import { DoubleAuthService } from './double-auth.service.js';
import {
  ActivationApplicationDto,
  ConfirmationMotDePasseDto,
} from './dto/auth.dto.js';

/** Réglages de sa propre double authentification (personnel et concepteur). */
@Controller('auth/double-auth')
@Roles(...PERSONNEL, Role.SUPER_ADMIN)
export class DoubleAuthController {
  constructor(private readonly doubleAuth: DoubleAuthService) {}

  @Get()
  etat(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.doubleAuth.etat(u);
  }

  /** Clé et QR code à scanner avec l'application d'authentification. */
  @Post('application/preparation')
  @HttpCode(200)
  preparer(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.doubleAuth.preparerApplication(u);
  }

  /** Confirme l'application par un premier code ; renvoie les codes de secours (affichés une fois). */
  @Post('application')
  @HttpCode(200)
  activerApplication(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ActivationApplicationDto,
  ) {
    return this.doubleAuth.activerApplication(
      u,
      dto.jeton,
      dto.code,
      dto.motDePasse,
    );
  }

  @Post('email')
  @HttpCode(200)
  choisirEmail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConfirmationMotDePasseDto,
  ) {
    return this.doubleAuth.choisirEmail(u, dto.motDePasse);
  }

  /** Retrait (impossible pour la direction, la comptabilité et le concepteur). */
  @Post('desactivation')
  @HttpCode(200)
  desactiver(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConfirmationMotDePasseDto,
  ) {
    return this.doubleAuth.desactiver(u, dto.motDePasse);
  }

  @Post('codes-secours')
  @HttpCode(200)
  codesSecours(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConfirmationMotDePasseDto,
  ) {
    return this.doubleAuth.nouveauxCodesSecours(u, dto.motDePasse);
  }
}
