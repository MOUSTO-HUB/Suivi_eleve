import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MESSAGE_JOUR = 'La date doit être au format AAAA-MM-JJ.';

/** Appel : les élèves absents d'une séance. */
export class SignalerAbsencesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cochez au moins un élève absent.' })
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  eleveIds: string[];

  @Matches(JOUR, { message: MESSAGE_JOUR })
  date: string;

  /** Ex. « 08h-10h », « matinée », « journée ». */
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Précisez le créneau (ex. 08h-10h).' })
  @MaxLength(60)
  creneau: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(60)
  matiere?: string;

  /** Absence déjà justifiée (la famille a prévenu) : aucun message n'est envoyé. */
  @IsOptional()
  @IsBoolean()
  justifiee?: boolean;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(300)
  motif?: string;
}

export class JustifierAbsenceDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le motif est obligatoire.' })
  @MaxLength(300)
  motif: string;
}

export class FiltreAbsencesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  eleveId?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;

  @IsOptional()
  @Matches(JOUR, { message: MESSAGE_JOUR })
  du?: string;

  @IsOptional()
  @Matches(JOUR, { message: MESSAGE_JOUR })
  au?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  justifiee?: boolean;
}
