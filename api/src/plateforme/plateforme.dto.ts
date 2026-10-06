import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstEmail, EstTelephone, Nettoyer } from '../common/validation.js';
import type {
  FormuleAbonnement,
  MoyenPaiementAbonnement,
  Pays,
} from '../generated/prisma/enums.js';

const PAYS = ['GN', 'CI', 'SN'] as const;
const FORMULES = ['MENSUEL', 'ANNUEL'] as const;
const MOYENS = [
  'ORANGE_MONEY',
  'MTN_MOBILE_MONEY',
  'WAVE',
  'VIREMENT',
  'ESPECES',
  'AUTRE',
] as const;
const ETATS = [
  'ESSAI',
  'ACTIF',
  'A_RENOUVELER',
  'EN_RETARD',
  'SUSPENDUE',
] as const;

class InfosEcoleDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: "Le nom de l'école est obligatoire." })
  @MaxLength(120)
  nom: string;

  @IsIn(PAYS, {
    message: 'Pays : GN (Guinée), CI (Côte d’Ivoire) ou SN (Sénégal).',
  })
  pays: Pays;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(200)
  adresse?: string;

  @IsOptional()
  @Nettoyer()
  @EstTelephone()
  telephone?: string;

  @IsOptional()
  @Nettoyer()
  @EstEmail()
  email?: string;
}

/** Nouvelle école et son premier compte de direction (1 mois d'essai). */
export class CreerEcoleDto extends InfosEcoleDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le prénom du directeur est obligatoire.' })
  @MaxLength(80)
  directionPrenoms: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom du directeur est obligatoire.' })
  @MaxLength(80)
  directionNom: string;

  /** Identifiant de connexion de la direction. */
  @EstEmail()
  directionEmail: string;

  /** Année de la rentrée (ex. 2026 pour 2026-2027) ; par défaut l'année scolaire en cours. */
  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  anneeRentree?: number;
}

export class ModifierEcoleDto extends InfosEcoleDto {}

export class PaiementAbonnementDto {
  @IsIn(FORMULES, { message: 'Formule : MENSUEL ou ANNUEL.' })
  formule: FormuleAbonnement;

  @IsIn(MOYENS, { message: 'Moyen de paiement inconnu.' })
  moyen: MoyenPaiementAbonnement;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  reference?: string;

  /** Jour du paiement (AAAA-MM-JJ), au plus aujourd'hui. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La date doit être au format AAAA-MM-JJ.',
  })
  payeLe: string;

  /** Montant reçu en GNF ; par défaut le tarif de la formule (remise possible). */
  @IsOptional()
  @IsInt({ message: 'Le montant est un nombre entier de GNF.' })
  @Min(0)
  @Max(100_000_000)
  montant?: number;
}

export class SuspensionDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Indiquez le motif de la suspension.' })
  @MaxLength(300)
  motif: string;
}

export class FiltreEcolesDto {
  @IsOptional()
  @IsIn(ETATS)
  etat?: (typeof ETATS)[number];

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  recherche?: string;
}
