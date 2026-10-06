import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import { LIMITES, LimiteurService } from '../securite/limiteur.service.js';
import { AuthService } from './auth.service.js';
import type { Session, UtilisateurConnecte } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { OuvertAuConcepteur } from './decorators/ouvert-au-concepteur.decorator.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import {
  ConnexionDto,
  ConsentementDto,
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
    private readonly limiteur: LimiteurService,
  ) {}

  /** Personnel de l'école : email + mot de passe (limité par IP et par compte). */
  @Public()
  @Post('connexion')
  @HttpCode(200)
  async connexion(
    @Body() dto: ConnexionDto,
    @Ip() ip: string,
  ): Promise<Session> {
    await this.limiteur.verifier(LIMITES.connexionIp, ip);
    await this.limiteur.verifier(LIMITES.connexionEmail, dto.email);
    return this.auth.connexionPersonnel(dto.email, dto.motDePasse);
  }

  /** Parents : demande d'un code par SMS (limité par IP et par numéro). */
  @Public()
  @Post('otp/demande')
  @HttpCode(202)
  async demanderOtp(@Body() dto: DemandeOtpDto, @Ip() ip: string) {
    await this.limiteur.verifier(LIMITES.otpDemandeIp, ip);
    await this.otp.demanderCode(dto.telephone);
    return { message: 'Si ce numéro est connu, un code a été envoyé par SMS.' };
  }

  /** Parents : vérification du code reçu (3 essais par code, limité par IP). */
  @Public()
  @Post('otp/verification')
  @HttpCode(200)
  async verifierOtp(
    @Body() dto: VerificationOtpDto,
    @Ip() ip: string,
  ): Promise<Session> {
    await this.limiteur.verifier(LIMITES.otpVerificationIp, ip);
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

  /** Tout utilisateur connecté, concepteur compris : son profil (et, pour un parent, le consentement). */
  @OuvertAuConcepteur()
  @Get('moi')
  moi(@UtilisateurCourant() utilisateur: UtilisateurConnecte) {
    return this.auth.profil(utilisateur.id);
  }

  /** Le parent accepte le texte d'information (stocké avec sa version et la date). */
  @Post('consentement')
  @Roles(Role.PARENT)
  @HttpCode(200)
  consentir(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: ConsentementDto,
  ) {
    return this.auth.consentir(u, dto.version);
  }
}
