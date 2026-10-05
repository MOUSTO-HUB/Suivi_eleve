import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';
import {
  CanalNotification,
  StatutNotification,
  TypeNotification,
} from '../generated/prisma/enums.js';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export class FiltreJournalDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TypeNotification)
  type?: TypeNotification;

  @IsOptional()
  @IsEnum(CanalNotification)
  canal?: CanalNotification;

  @IsOptional()
  @IsEnum(StatutNotification)
  statut?: StatutNotification;

  @IsOptional()
  @IsUUID()
  eleveId?: string;

  @IsOptional()
  @IsUUID()
  tuteurId?: string;

  @IsOptional()
  @Matches(JOUR, { message: 'Date au format AAAA-MM-JJ.' })
  du?: string;

  @IsOptional()
  @Matches(JOUR, { message: 'Date au format AAAA-MM-JJ.' })
  au?: string;

  /** Numéro ou adresse du destinataire. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class StatistiquesDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Mois au format AAAA-MM.' })
  mois?: string;
}

export class PreferenceDto {
  @IsEnum(TypeNotification)
  type: TypeNotification;

  @IsBoolean()
  sms: boolean;

  @IsBoolean()
  email: boolean;

  @IsBoolean()
  push: boolean;
}

export class PreferencesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PreferenceDto)
  preferences: PreferenceDto[];
}

export class ModeleDto {
  /** Objet de l'email ou titre du push ; ignoré pour un SMS. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(150)
  sujet?: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le contenu du message est obligatoire.' })
  @MaxLength(2000)
  contenu: string;
}

export class ParamsModeleDto {
  @IsEnum(TypeNotification)
  type: TypeNotification;

  @IsIn(['SMS', 'EMAIL', 'PUSH'])
  canal: 'SMS' | 'EMAIL' | 'PUSH';
}

export class JetonPushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  jeton: string;

  @IsIn(['ANDROID', 'IOS', 'WEB'])
  plateforme: 'ANDROID' | 'IOS' | 'WEB';
}
