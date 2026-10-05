import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { Session, UtilisateurConnecte } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import {
  ConnexionDto,
  DemandeOtpDto,
  RafraichissementDto,
  VerificationOtpDto,
} from './dto/auth.dto.js';
import { OtpService } from './otp.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  /** Personnel de l'école : email + mot de passe. */
  @Public()
  @Post('connexion')
  @HttpCode(200)
  connexion(@Body() dto: ConnexionDto): Promise<Session> {
    return this.auth.connexionPersonnel(dto.email, dto.motDePasse);
  }

  /** Parents : demande d'un code par SMS. */
  @Public()
  @Post('otp/demande')
  @HttpCode(202)
  async demanderOtp(@Body() dto: DemandeOtpDto) {
    await this.otp.demanderCode(dto.telephone);
    return { message: 'Si ce numéro est connu, un code a été envoyé par SMS.' };
  }

  /** Parents : vérification du code reçu. */
  @Public()
  @Post('otp/verification')
  @HttpCode(200)
  verifierOtp(@Body() dto: VerificationOtpDto): Promise<Session> {
    return this.otp.verifierCode(dto.telephone, dto.code);
  }

  @Public()
  @Post('rafraichir')
  @HttpCode(200)
  rafraichir(@Body() dto: RafraichissementDto): Promise<Session> {
    return this.auth.rafraichir(dto.jetonRafraichissement);
  }

  @Public()
  @Post('deconnexion')
  @HttpCode(204)
  async deconnexion(@Body() dto: RafraichissementDto): Promise<void> {
    await this.auth.deconnexion(dto.jetonRafraichissement);
  }

  @Get('moi')
  moi(@UtilisateurCourant() utilisateur: UtilisateurConnecte) {
    return this.auth.profil(utilisateur.id);
  }
}
