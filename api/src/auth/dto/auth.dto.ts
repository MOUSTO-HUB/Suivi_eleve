import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { EstEmail, EstTelephone } from '../../common/validation.js';

/** Réponse au défi « Je ne suis pas un robot » (ALTCHA), obligatoire sur les formulaires publics. */
class AvecAltchaDto {
  @IsString({ message: 'Cochez la case « Je ne suis pas un robot ».' })
  @MaxLength(2000)
  altcha: string;
}

export class ConnexionDto extends AvecAltchaDto {
  @EstEmail()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(200)
  motDePasse: string;
}

export class DemandeOtpDto extends AvecAltchaDto {
  @EstTelephone()
  telephone: string;
}

export class VerificationOtpDto {
  @EstTelephone()
  telephone: string;

  @Matches(/^\d{6}$/, { message: 'Le code contient 6 chiffres.' })
  code: string;
}

export class RafraichissementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jetonRafraichissement: string;
}

export class ConsentementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  version: string;
}

/** Jeton de l'étape « code » renvoyé par /auth/connexion. */
export class DefiDoubleAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  jeton: string;
}

export class VerificationDoubleAuthDto extends DefiDoubleAuthDto {
  /** 6 chiffres (application ou email) ou code de secours (« k7pm-x3qa »). */
  @IsString()
  @Matches(/^\s*(\d{6}|[A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4})\s*$/, {
    message: 'Saisissez le code à 6 chiffres (ou un code de secours).',
  })
  code: string;
}

export class OubliMotDePasseDto extends AvecAltchaDto {
  @EstEmail()
  email: string;
}

export class ReinitialisationMotDePasseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jeton: string;

  @IsString()
  @MaxLength(200)
  nouveau: string;
}

/** Réglages de la double authentification : le mot de passe est redemandé. */
export class ConfirmationMotDePasseDto {
  @IsString()
  @IsNotEmpty({ message: 'Saisissez votre mot de passe.' })
  @MaxLength(200)
  motDePasse: string;
}

export class ActivationApplicationDto extends ConfirmationMotDePasseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  jeton: string;

  @Matches(/^\s*\d{6}\s*$/, { message: 'Le code contient 6 chiffres.' })
  code: string;
}
