import { PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { EstEmail, EstTelephone, Nettoyer } from '../common/validation.js';
import { Langue } from '../generated/prisma/enums.js';

export class CreerTuteurDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Les prénoms du tuteur sont obligatoires.' })
  @MaxLength(100)
  prenoms: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom du tuteur est obligatoire.' })
  @MaxLength(100)
  nom: string;

  /** Contact_tuteur_1 : obligatoire. */
  @EstTelephone()
  contact1: string;

  /** Contact_tuteur_2 : facultatif. */
  @IsOptional()
  @Nettoyer()
  @EstTelephone()
  contact2?: string;

  @IsOptional()
  @Nettoyer()
  @EstEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Langue)
  langue?: Langue;
}

export class ModifierTuteurDto extends PartialType(CreerTuteurDto) {}

export class FiltreTuteursDto extends PaginationDto {
  /** Recherche dans le nom, les prénoms, les contacts et l'email. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  q?: string;
}
