import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';
import { StatutRappel } from '../generated/prisma/enums.js';

export class CreerRappelDto {
  @IsUUID()
  eleveId: string;

  /** Ex. « Mensualité d'octobre 2026 », « Frais d'inscription ». */
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Indiquez ce qui est à payer.' })
  @MaxLength(60)
  libelle: string;

  @IsInt({
    message:
      'Le montant doit être un nombre entier (GNF ou FCFA, sans centimes).',
  })
  @Min(1, { message: 'Le montant doit être positif.' })
  @Max(100_000_000)
  montant: number;

  /** Date de paiement normale (AAAA-MM-JJ). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La date doit être au format AAAA-MM-JJ.',
  })
  dateEcheance: string;
}

export class FiltreRappelsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(StatutRappel)
  statut?: StatutRappel;

  @IsOptional()
  @IsUUID()
  eleveId?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;
}
