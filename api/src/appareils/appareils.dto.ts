import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';
import {
  StatutAppareil,
  TypeAppareil,
  TypeIncidentAppareil,
} from '../generated/prisma/enums.js';
import { imeiValide } from './appareils.regles.js';

/** IMEI à 15 chiffres avec clé de contrôle ; espaces et tirets tolérés à la saisie. */
const EstImei = () =>
  ValidateBy({
    name: 'estImei',
    validator: {
      validate: (v: unknown) => typeof v === 'string' && imeiValide(v),
      defaultMessage: () =>
        'IMEI invalide : 15 chiffres (composez *#06# sur le téléphone pour l’afficher).',
    },
  });

const sansEspaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s-]/g, '') || undefined : value;

export class CreerAppareilDto {
  @IsUUID()
  eleveId: string;

  @IsEnum(TypeAppareil, {
    message: 'Type invalide : TELEPHONE, TABLETTE, ORDINATEUR ou AUTRE.',
  })
  type: TypeAppareil;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(60)
  marque?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(60)
  modele?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(40)
  couleur?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(80)
  numeroSerie?: string;

  @IsOptional()
  @Transform(sansEspaces)
  @EstImei()
  imei?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(500)
  signesDistinctifs?: string;
}

export class ModifierAppareilDto extends PartialType(
  OmitType(CreerAppareilDto, ['eleveId'] as const),
) {}

export class FiltreAppareilsDto extends PaginationDto {
  /** IMEI, numéro de série, code de l'étiquette, marque, couleur, signes, élève. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(StatutAppareil)
  statut?: StatutAppareil;

  @IsOptional()
  @IsUUID()
  eleveId?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;
}

export class SignalementDto {
  @IsEnum(TypeIncidentAppareil, {
    message:
      'Type invalide : DECLARE_PERDU, TROUVE, CONFISQUE, RESTITUE ou USAGE_EN_CLASSE.',
  })
  type: TypeIncidentAppareil;

  /** Par défaut : maintenant. */
  @IsOptional()
  @IsISO8601()
  dateHeure?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(120)
  lieu?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(500)
  commentaire?: string;
}

export class EtiquettesDto {
  @IsOptional()
  @IsUUID()
  eleveId?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;
}
