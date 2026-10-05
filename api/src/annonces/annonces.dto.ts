import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';
import {
  CibleAnnonce,
  MotifAnnonce,
  StatutAnnonce,
  TypeAnnonce,
} from '../generated/prisma/enums.js';

const TYPES = [TypeAnnonce.PAS_DE_COURS, TypeAnnonce.LIBERATION_ANTICIPEE];

export class CreerAnnonceDto {
  @IsIn(TYPES, {
    message: 'Type invalide : PAS_DE_COURS ou LIBERATION_ANTICIPEE.',
  })
  type: TypeAnnonce;

  @IsEnum(CibleAnnonce, { message: 'Cible invalide : ECOLE ou CLASSES.' })
  cible: CibleAnnonce;

  @ValidateIf((a: CreerAnnonceDto) => a.cible === CibleAnnonce.CLASSES)
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins une classe.' })
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  classeIds?: string[];

  /** Jour concerné (AAAA-MM-JJ). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La date doit être au format AAAA-MM-JJ.',
  })
  date: string;

  /** Libération : heure de sortie (HH:MM, heure de Dakar). */
  @ValidateIf(
    (a: CreerAnnonceDto) => a.type === TypeAnnonce.LIBERATION_ANTICIPEE,
  )
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "L'heure de sortie doit être au format HH:MM.",
  })
  heure?: string;

  /** Pas de cours : « toute la journée », « le matin », « de 8h à 10h »… */
  @ValidateIf((a: CreerAnnonceDto) => a.type === TypeAnnonce.PAS_DE_COURS)
  @Nettoyer()
  @IsString({ message: 'Précisez le créneau concerné.' })
  @MaxLength(80)
  creneau?: string;

  @IsEnum(MotifAnnonce, { message: 'Le motif est obligatoire.' })
  motif: MotifAnnonce;

  @ValidateIf((a: CreerAnnonceDto) => a.motif === MotifAnnonce.AUTRE)
  @Nettoyer()
  @IsString({ message: 'Précisez le motif.' })
  @MaxLength(120)
  motifDetail?: string;

  /** Complément libre, ajouté à l'email et à l'application. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(1000)
  message?: string;

  /** Envoi programmé (ISO 8601) ; absent = envoi immédiat. */
  @IsOptional()
  @IsISO8601({}, { message: "Date d'envoi invalide." })
  programmeeLe?: string;
}

export class FiltreAnnoncesDto extends PaginationDto {
  @IsOptional()
  @IsIn(TYPES)
  type?: TypeAnnonce;

  @IsOptional()
  @IsEnum(StatutAnnonce)
  statut?: StatutAnnonce;
}
