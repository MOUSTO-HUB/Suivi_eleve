import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Numéro WhatsApp du service (API WhatsApp Cloud de Meta), utilisé pour la
 * connexion des parents par « code inversé ». Activé par WHATSAPP_NUMERO.
 *
 * Les messages reçus sont gratuits. Les réponses (messages de « service », dans
 * les 24 heures qui suivent le message du parent) sont gratuites jusqu'à 1 000
 * par mois et par numéro, payantes au-delà (tarifs Meta depuis le 1er octobre 2026).
 */
@Injectable()
export class WhatsappClient {
  private readonly logger = new Logger(WhatsappClient.name);
  /** Numéro affiché aux parents (E.164), absent si la connexion WhatsApp est désactivée. */
  readonly numero?: string;
  /** Secret de l'application Meta : vérifie la signature des webhooks. */
  readonly secretApplication?: string;
  /** Jeton choisi lors de la déclaration du webhook chez Meta. */
  readonly jetonVerification?: string;
  private readonly idNumero?: string;
  private readonly jetonAcces?: string;
  private readonly versionApi: string;

  constructor(config: ConfigService) {
    this.numero = config.get<string>('WHATSAPP_NUMERO') || undefined;
    this.idNumero = config.get<string>('WHATSAPP_ID_NUMERO') || undefined;
    this.jetonAcces = config.get<string>('WHATSAPP_JETON_ACCES') || undefined;
    this.versionApi = config.get<string>('WHATSAPP_VERSION_API') || 'v23.0';
    if (!this.numero) return;
    this.secretApplication = config.get<string>('WHATSAPP_SECRET_APPLICATION');
    this.jetonVerification = config.get<string>('WHATSAPP_JETON_VERIFICATION');
    if (!this.secretApplication || !this.jetonVerification) {
      throw new Error(
        'WHATSAPP_NUMERO est renseigné : WHATSAPP_SECRET_APPLICATION et WHATSAPP_JETON_VERIFICATION sont obligatoires.',
      );
    }
  }

  get actif(): boolean {
    return Boolean(this.numero);
  }

  /** Réponse au parent (sans effet si WHATSAPP_ID_NUMERO ou WHATSAPP_JETON_ACCES manque). */
  async repondre(telephone: string, texte: string): Promise<void> {
    if (!this.idNumero || !this.jetonAcces) {
      this.logger.log(
        `[WhatsApp] Réponse non envoyée à ${telephone} : ${texte}`,
      );
      return;
    }
    try {
      const reponse = await fetch(
        `https://graph.facebook.com/${this.versionApi}/${this.idNumero}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.jetonAcces}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: telephone.replace(/^\+/, ''),
            type: 'text',
            text: { body: texte },
          }),
        },
      );
      if (!reponse.ok) {
        this.logger.warn(
          `Réponse WhatsApp en échec (${reponse.status}) : ${(await reponse.text()).slice(0, 300)}`,
        );
      }
    } catch (e) {
      // La connexion ne dépend pas de cette réponse : l'appareil du parent est déjà prévenu.
      this.logger.warn(`Réponse WhatsApp en échec : ${String(e)}`);
    }
  }
}
