import { Global, Injectable, Module } from '@nestjs/common';
import { SmsSender } from '../sms/sms.sender.js';
import { CanauxService } from './canaux.service.js';
import { EnvoiService } from './envoi.service.js';
import { ModelesService } from './modeles.service.js';
import { NotificationsController } from './notifications.controller.js';
import { preparerSms } from './notifications.regles.js';
import { NotificationsService } from './notifications.service.js';

/** Codes de connexion des parents : envoi direct (pas de file), avec bascule de fournisseur. */
@Injectable()
class SmsDirect extends SmsSender {
  constructor(private readonly canaux: CanauxService) {
    super();
  }

  async envoyer(telephone: string, message: string): Promise<void> {
    await this.canaux.envoyerSms(telephone, preparerSms(message), 'otp');
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    CanauxService,
    EnvoiService,
    NotificationsService,
    ModelesService,
    { provide: SmsSender, useClass: SmsDirect },
  ],
  exports: [NotificationsService, SmsSender],
})
export class NotificationsModule {}
