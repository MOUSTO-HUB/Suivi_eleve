import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';
import {
  CategorieComportement,
  StatutValidation,
  TypeComportement,
} from '../generated/prisma/enums.js';

export class SignalerComportementDto {
  @IsUUID()
  eleveId: string;

  @IsEnum(TypeComportement, { message: 'Type invalide : POSITIF ou NEGATIF.' })
  type: TypeComportement;

  @IsEnum(CategorieComportement, { message: 'Catégorie invalide.' })
  categorie: CategorieComportement;

  /** Comportement négatif : 1 (léger) à 3 (grave, validé par la direction). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  gravite?: number;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Décrivez les faits.' })
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(300)
  sanction?: string;

  /** Rendez-vous avec la famille (ISO 8601, heure de Dakar). */
  @IsOptional()
  @IsISO8601({}, { message: 'Date de convocation invalide.' })
  convocationLe?: string;

  /** Date des faits ; par défaut maintenant. */
  @IsOptional()
  @IsISO8601({}, { message: 'Date des faits invalide.' })
  date?: string;
}

export class RejeterComportementDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Indiquez le motif du refus.' })
  @MaxLength(300)
  motif: string;
}

export class FiltreComportementsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  eleveId?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;

  @IsOptional()
  @IsEnum(TypeComportement)
  type?: TypeComportement;

  @IsOptional()
  @IsEnum(StatutValidation)
  statut?: StatutValidation;

  /** Seulement les convocations à venir. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  convocations?: boolean;
}
