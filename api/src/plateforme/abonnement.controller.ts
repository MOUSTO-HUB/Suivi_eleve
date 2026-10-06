import { Controller, Get } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { PlateformeService } from './plateforme.service.js';

/** La direction d'une école consulte son abonnement au service. */
@Controller('abonnement')
export class AbonnementController {
  constructor(private readonly plateforme: PlateformeService) {}

  /** État (essai, actif, à renouveler, en retard), date de fin, tarifs et paiements. */
  @Get()
  @Roles(Role.ADMIN)
  abonnement(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.plateforme.abonnementEcole(u.ecoleId);
  }
}
