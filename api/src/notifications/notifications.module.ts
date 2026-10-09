import { Global, Injectable, Module } from '@nestjs/common';
import { EmailSender } from '../sms/email.sender.js';
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

/** Codes et liens de sécurité du personnel : envoi direct (pas de file). */
@Injectable()
class EmailDirect extends EmailSender {
  constructor(private readonly canaux: CanauxService) {
    super();
  }

  async envoyer(adresse: string, sujet: string, texte: string): Promise<void> {
    await this.canaux.envoyerEmail(adresse, sujet, texte, 'securite');
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
    { provide: EmailSender, useClass: EmailDirect },
  ],
  exports: [NotificationsService, SmsSender, EmailSender],
})
export class NotificationsModule {}
