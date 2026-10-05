import { PartialType } from '@nestjs/mapped-types';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Nettoyer } from '../common/validation.js';

export class CreerClasseDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la classe est obligatoire.' })
  @MaxLength(50)
  nom: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le niveau est obligatoire.' })
  @MaxLength(50)
  niveau: string;

  @IsOptional()
  @IsUUID()
  enseignantPrincipalId?: string;

  /** Par défaut : l'année scolaire active. */
  @IsOptional()
  @IsUUID()
  anneeScolaireId?: string;
}

export class ModifierClasseDto extends PartialType(CreerClasseDto) {}

export class FiltreClassesDto {
  /** Par défaut : l'année scolaire active. */
  @IsOptional()
  @IsUUID()
  anneeScolaireId?: string;
}
