import { Global, Module } from '@nestjs/common';
import { AbonnementController } from './abonnement.controller.js';
import { EtatEcolesService } from './etat-ecoles.service.js';
import { PlateformeController } from './plateforme.controller.js';
import { PlateformeService } from './plateforme.service.js';

/** Espace concepteur : écoles abonnées et abonnements. Global pour EtatEcolesService. */
@Global()
@Module({
  controllers: [PlateformeController, AbonnementController],
  providers: [PlateformeService, EtatEcolesService],
  exports: [EtatEcolesService],
})
export class PlateformeModule {}
