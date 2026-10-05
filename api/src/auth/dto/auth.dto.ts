import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const enMinusculesSansEspaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Accepte « +221 77 123 45 67 » et le ramène à « +221771234567 » (E.164). */
const normaliserTelephone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s.-]/g, '') : value;

export class ConnexionDto {
  @Transform(enMinusculesSansEspaces)
  @IsEmail({}, { message: "L'adresse email n'est pas valide." })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(200)
  motDePasse: string;
}

export class DemandeOtpDto {
  @Transform(normaliserTelephone)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Le numéro doit être au format international, par exemple +221771234567.',
  })
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
