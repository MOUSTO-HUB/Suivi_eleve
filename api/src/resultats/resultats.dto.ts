import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Nettoyer } from '../common/validation.js';
import { DecisionFinAnnee } from '../generated/prisma/enums.js';

export class ClassePeriodeDto {
  @IsUUID()
  classeId: string;

  @IsUUID()
  periodeId: string;
}

class LigneMoyenneDto {
  @IsUUID()
  eleveId: string;

  /** Sur 20, 2 décimales au plus ; null = non noté. */
  @ValidateIf((_, v) => v !== null)
  @IsNumber({}, { message: 'La moyenne doit être un nombre.' })
  moyenne: number | null;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(300)
  appreciation?: string;
}

/** Moyennes d'une matière pour une classe et une période (professeur de la matière). */
export class MoyennesMatiereDto extends ClassePeriodeDto {
  @IsUUID()
  matiereId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => LigneMoyenneDto)
  lignes: LigneMoyenneDto[];
}

class LigneGeneraleDto extends LigneMoyenneDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt({ message: 'Le rang doit être un nombre entier.' })
  rang?: number | null;
}

/** Moyenne générale, rang et appréciation (professeur principal ou direction). */
export class ResultatsGenerauxDto extends ClassePeriodeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => LigneGeneraleDto)
  lignes: LigneGeneraleDto[];
}

class LigneDecisionDto {
  @IsUUID()
  eleveId: string;

  @IsEnum(DecisionFinAnnee, {
    message: 'Décision invalide : ADMIS, REDOUBLE, EXCLU ou ORIENTE.',
  })
  decision: DecisionFinAnnee;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  moyenneAnnuelle?: number | null;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(300)
  observation?: string;
}

export class DecisionsDto {
  @IsUUID()
  classeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => LigneDecisionDto)
  lignes: LigneDecisionDto[];
}

export class ClasseDto {
  @IsUUID()
  classeId: string;
}
