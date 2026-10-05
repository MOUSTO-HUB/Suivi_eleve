import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Nettoyer } from '../common/validation.js';
import { Role } from '../generated/prisma/enums.js';

export class CreerMatiereDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la matière est obligatoire.' })
  @MaxLength(60)
  nom: string;

  /** Affiché sur le bulletin ; n'entre dans aucun calcul. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(20)
  coefficient?: number;
}

export class ModifierMatiereDto {
  @IsOptional()
  @Nettoyer()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nom?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(20)
  coefficient?: number;
}

export class EnseignementDto {
  @IsUUID()
  matiereId: string;

  /** null : matière enseignée, professeur pas encore désigné. */
  @IsOptional()
  @IsUUID()
  enseignantId?: string | null;
}

export class EnseignementsDto {
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EnseignementDto)
  enseignements: EnseignementDto[];
}

export class FiltrePersonnelDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
