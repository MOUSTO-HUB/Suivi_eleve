import { Injectable, Logger } from '@nestjs/common';

/**
 * Envoi direct d'un SMS. Le moteur de notifications (prompt 6) ajoutera les
 * fournisseurs réels (Orange SMS API, Twilio) derrière cette même interface.
 */
export abstract class SmsSender {
  abstract envoyer(telephone: string, message: string): Promise<void>;
}

/** Développement uniquement : écrit le SMS dans les logs au lieu de l'envoyer. */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly logger = new Logger('SMS');

  envoyer(telephone: string, message: string): Promise<void> {
    this.logger.log(`[simulation] vers ${telephone} : ${message}`);
    return Promise.resolve();
  }
}
