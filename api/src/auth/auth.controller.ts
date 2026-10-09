import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import { AltchaService } from '../securite/altcha.service.js';
import { LIMITES, LimiteurService } from '../securite/limiteur.service.js';
import { AuthService } from './auth.service.js';
import type { Session, UtilisateurConnecte } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { OuvertAuConcepteur } from './decorators/ouvert-au-concepteur.decorator.js';
import { UtilisateurCourant } from './decorators/utilisateur-courant.decorator.js';
import type { DefiDoubleAuth } from './double-auth.service.js';
import {
  ConnexionDto,
  ConsentementDto,
  DefiDoubleAuthDto,
  DemandeOtpDto,
  OubliMotDePasseDto,
  RafraichissementDto,
  ReinitialisationMotDePasseDto,
  VerificationDoubleAuthDto,
  VerificationOtpDto,
} from './dto/auth.dto.js';
import { MotDePasseService } from './mot-de-passe.service.js';
import { OtpService } from './otp.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly motDePasse: MotDePasseService,
    private readonly limiteur: LimiteurService,
    private readonly altcha: AltchaService,
  ) {}

  /** Défi « Je ne suis pas un robot » (ALTCHA) à résoudre avant un formulaire public. */
  @Public()
  @Get('altcha')
  defiAltcha() {
    return this.altcha.defi();
  }

  /**
   * Personnel de l'école : email + mot de passe (limité par IP et par compte,
   * blocage progressif). Renvoie la session, ou l'étape du code (double authentification).
   */
  @Public()
  @Post('connexion')
  @HttpCode(200)
  async connexion(
    @Body() dto: ConnexionDto,
    @Ip() ip: string,
  ): Promise<Session | DefiDoubleAuth> {
    await this.altcha.verifier(dto.altcha);
    await this.limiteur.verifier(LIMITES.connexionIp, ip);
    await this.limiteur.verifier(LIMITES.connexionEmail, dto.email);
    return this.auth.connexionPersonnel(dto.email, dto.motDePasse);
  }

  /** Double authentification : code de l'application, reçu par email, ou code de secours. */
  @Public()
  @Post('double-auth/verification')
  @HttpCode(200)
  async verifierDoubleAuth(
    @Body() dto: VerificationDoubleAuthDto,
    @Ip() ip: string,
  ): Promise<Session> {
    await this.limiteur.verifier(LIMITES.doubleAuthIp, ip);
    return this.auth.verifierDoubleAuth(dto.jeton, dto.code);
  }

  /** Double authentification par email : renvoyer un code (3 par quart d'heure). */
  @Public()
  @Post('double-auth/renvoi')
  @HttpCode(202)
  async renvoyerCode(@Body() dto: DefiDoubleAuthDto, @Ip() ip: string) {
    await this.limiteur.verifier(LIMITES.doubleAuthIp, ip);
    await this.auth.renvoyerCode(dto.jeton);
    return { message: 'Un nouveau code a été envoyé par email.' };
  }

  /** Parents : demande d'un code par SMS (limité par IP et par numéro). */
  @Public()
  @Post('otp/demande')
  @HttpCode(202)
  async demanderOtp(@Body() dto: DemandeOtpDto, @Ip() ip: string) {
    await this.altcha.verifier(dto.altcha);
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

  /** Personnel : lien de réinitialisation par email (même réponse que l'email soit connu ou non). */
  @Public()
  @Post('mot-de-passe/oubli')
  @HttpCode(202)
  async oubliMotDePasse(@Body() dto: OubliMotDePasseDto, @Ip() ip: string) {
    await this.altcha.verifier(dto.altcha);
    await this.limiteur.verifier(LIMITES.oubliIp, ip);
    await this.motDePasse.demander(dto.email);
    return {
      message:
        'Si cette adresse correspond à un compte, un lien vient d’y être envoyé. Il est valable 30 minutes.',
    };
  }

  /** Nouveau mot de passe choisi depuis le lien reçu ; toutes les sessions sont fermées. */
  @Public()
  @Post('mot-de-passe/reinitialisation')
  @HttpCode(204)
  async reinitialiserMotDePasse(
    @Body() dto: ReinitialisationMotDePasseDto,
    @Ip() ip: string,
  ): Promise<void> {
    await this.limiteur.verifier(LIMITES.reinitialisationIp, ip);
    await this.motDePasse.reinitialiser(dto.jeton, dto.nouveau);
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
