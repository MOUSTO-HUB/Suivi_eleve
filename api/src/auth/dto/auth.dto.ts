import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { EstEmail, EstTelephone } from '../../common/validation.js';

export class ConnexionDto {
  @EstEmail()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(200)
  motDePasse: string;
}

export class DemandeOtpDto {
  @EstTelephone()
  telephone: string;
}

export class VerificationOtpDto extends DemandeOtpDto {
  @Matches(/^\d{6}$/, { message: 'Le code contient 6 chiffres.' })
  code: string;
}

export class RafraichissementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jetonRafraichissement: string;
}
