import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstEmail, Nettoyer } from '../common/validation.js';
import { Role } from '../generated/prisma/enums.js';

/** Rôles du personnel (les comptes parents naissent de la connexion par code SMS). */
export const ROLES_PERSONNEL = [
  Role.ADMIN,
  Role.SECRETARIAT,
  Role.ENSEIGNANT,
  Role.SURVEILLANT,
  Role.COMPTABLE,
] as const;

const MESSAGE_ROLE =
  'Rôle invalide : ADMIN, SECRETARIAT, ENSEIGNANT, SURVEILLANT ou COMPTABLE.';

export class CreerUtilisateurDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MaxLength(80)
  prenoms: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(80)
  nom: string;

  @EstEmail()
  email: string;

  @IsIn(ROLES_PERSONNEL, { message: MESSAGE_ROLE })
  role: Role;
}

export class ModifierUtilisateurDto {
  @IsOptional()
  @Nettoyer()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  prenoms?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nom?: string;

  @IsOptional()
  @IsIn(ROLES_PERSONNEL, { message: MESSAGE_ROLE })
  role?: Role;

  /** Faux : le compte ne peut plus se connecter (ses sessions sont fermées). */
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class ChangerMotDePasseDto {
  @IsString()
  @IsNotEmpty({ message: 'Saisissez votre mot de passe actuel.' })
  @MaxLength(200)
  actuel: string;

  @IsString()
  @MaxLength(200)
  nouveau: string;
}
