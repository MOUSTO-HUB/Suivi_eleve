import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { EstEmail, EstTelephone, Nettoyer } from '../common/validation.js';
import { Genre, LienTuteur, StatutEleve } from '../generated/prisma/enums.js';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MESSAGE_JOUR = 'La date doit être au format AAAA-MM-JJ.';

/** Tuteur existant (tuteurId) ou nouveau tuteur (prenoms, nom, contact1). */
export class TuteurEleveDto {
  @IsOptional()
  @IsUUID()
  tuteurId?: string;

  @ValidateIf((t: TuteurEleveDto) => !t.tuteurId)
  @Nettoyer()
  @IsString({ message: 'Les prénoms du tuteur sont obligatoires.' })
  @MaxLength(100)
  prenoms?: string;

  @ValidateIf((t: TuteurEleveDto) => !t.tuteurId)
  @Nettoyer()
  @IsString({ message: 'Le nom du tuteur est obligatoire.' })
  @MaxLength(100)
  nom?: string;

  /** Contact_tuteur_1 : obligatoire pour un nouveau tuteur. */
  @ValidateIf((t: TuteurEleveDto) => !t.tuteurId)
  @EstTelephone()
  contact1?: string;

  @IsOptional()
  @Nettoyer()
  @EstTelephone()
  contact2?: string;

  @IsOptional()
  @Nettoyer()
  @EstEmail()
  email?: string;

  @IsEnum(LienTuteur, {
    message: 'Lien invalide : PERE, MERE, TUTEUR_LEGAL ou AUTRE.',
  })
  lien: LienTuteur;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;
}

export class CreerEleveDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Les prénoms sont obligatoires.' })
  @MaxLength(100)
  prenoms: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100)
  nom: string;

  @IsEnum(Genre, { message: 'Genre invalide : MASCULIN ou FEMININ.' })
  genre: Genre;

  @Matches(JOUR, { message: MESSAGE_JOUR })
  dateNaissance: string;

  /** Téléphone de l'élève : facultatif. */
  @IsOptional()
  @Nettoyer()
  @EstTelephone()
  telephone?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;

  /** Par défaut : aujourd'hui. Son année donne celle du matricule. */
  @IsOptional()
  @Matches(JOUR, { message: MESSAGE_JOUR })
  dateInscription?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un tuteur est obligatoire.' })
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => TuteurEleveDto)
  tuteurs: TuteurEleveDto[];
}

export class ModifierEleveDto extends PartialType(
  OmitType(CreerEleveDto, ['tuteurs', 'classeId', 'dateInscription'] as const),
) {}

export class ChangerClasseDto {
  @IsUUID()
  classeId: string;

  /** Date du changement ; par défaut aujourd'hui. */
  @IsOptional()
  @Matches(JOUR, { message: MESSAGE_JOUR })
  date?: string;
}

export class ArchiverEleveDto {
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(500)
  motif?: string;
}

export class FiltreElevesDto extends PaginationDto {
  /** Recherche dans le matricule, le nom, les prénoms et les tuteurs. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  classeId?: string;

  @IsOptional()
  @IsUUID()
  tuteurId?: string;

  /** Par défaut : ACTIF. */
  @IsOptional()
  @IsEnum(StatutEleve)
  statut?: StatutEleve;
}

export class ExportElevesDto extends OmitType(FiltreElevesDto, [
  'page',
  'parPage',
] as const) {
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx' = 'xlsx';
}

export class ImportElevesDto {
  /** true : vérifie le fichier sans rien enregistrer. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  simulation: boolean = false;
}

export class EffacerDonneesDto {
  /** Matricule de l'élève, saisi pour confirmer une opération irréversible. */
  @IsString()
  @IsNotEmpty({ message: "Saisissez le matricule de l'élève pour confirmer." })
  @MaxLength(20)
  confirmation: string;
}
