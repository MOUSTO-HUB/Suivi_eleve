import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Nettoyer } from '../common/validation.js';
import { CibleAnnonce } from '../generated/prisma/enums.js';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreerEvenementDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: "Donnez un titre à l'événement." })
  @MaxLength(80)
  titre: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: "Décrivez l'événement." })
  @MaxLength(2000)
  description: string;

  /** Jour de l'événement (AAAA-MM-JJ). */
  @Matches(JOUR, { message: 'La date doit être au format AAAA-MM-JJ.' })
  date: string;

  /** Heure de début (HH:MM, heure de Dakar). */
  @Matches(HEURE, { message: "L'heure doit être au format HH:MM." })
  heure: string;

  /** Dernier jour, pour un événement sur plusieurs jours. */
  @IsOptional()
  @Matches(JOUR, { message: 'La date de fin doit être au format AAAA-MM-JJ.' })
  dateFin?: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Indiquez le lieu.' })
  @MaxLength(120)
  lieu: string;

  /** Tenue, matériel, participation financière, horaires de retour… */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(1000)
  modalites?: string;

  @IsEnum(CibleAnnonce, { message: 'Public invalide : ECOLE ou CLASSES.' })
  cible: CibleAnnonce;

  @ValidateIf((e: CreerEvenementDto) => e.cible === CibleAnnonce.CLASSES)
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins une classe.' })
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  classeIds?: string[];

  /** Question oui / non posée aux parents (participation, autorisation). */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(200)
  question?: string;
}

export class PublierEvenementDto {
  /** Envoi programmé (ISO 8601) ; absent = envoi immédiat. */
  @IsOptional()
  @IsISO8601({}, { message: "Date d'envoi invalide." })
  programmeeLe?: string;
}

export class FiltreEvenementsDto {
  /** Premier jour affiché (AAAA-MM-JJ) ; par défaut, le début du mois. */
  @IsOptional()
  @Matches(JOUR, { message: 'La date doit être au format AAAA-MM-JJ.' })
  du?: string;

  /** Dernier jour affiché (AAAA-MM-JJ). */
  @IsOptional()
  @Matches(JOUR, { message: 'La date doit être au format AAAA-MM-JJ.' })
  au?: string;
}

export class RepondreEvenementDto {
  @IsUUID()
  eleveId: string;

  @IsBoolean({ message: 'Répondez par oui ou par non.' })
  reponse: boolean;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(300)
  commentaire?: string;
}
