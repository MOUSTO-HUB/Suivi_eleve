import { Role } from '../generated/prisma/enums.js';

/** Tout le personnel de l'école (lecture des dossiers). */
export const PERSONNEL = [
  Role.ADMIN,
  Role.SECRETARIAT,
  Role.ENSEIGNANT,
  Role.SURVEILLANT,
  Role.COMPTABLE,
] as const;

/** Inscriptions et dossiers élèves (écriture). */
export const GESTION_SCOLARITE = [Role.ADMIN, Role.SECRETARIAT] as const;
