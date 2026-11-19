import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ConnexionWhatsappService } from './connexion-whatsapp.service.js';
import { Public } from './decorators/public.decorator.js';
import { WhatsappClient } from './whatsapp.client.js';
import { messagesRecus, signatureValide } from './whatsapp.regles.js';

/**
 * Webhook de l'API WhatsApp Cloud (Meta) : messages reçus sur le numéro du
 * service. URL à déclarer chez Meta : https://DOMAINE/api/auth/whatsapp/webhook
 */
@Controller('auth/whatsapp/webhook')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsapp: WhatsappClient,
    private readonly connexion: ConnexionWhatsappService,
  ) {}

  /** Vérification demandée par Meta lors de la déclaration du webhook. */
  @Public()
  @Get()
  verifier(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') jeton?: string,
    @Query('hub.challenge') defi?: string,
  ): string {
    const attendu = this.whatsapp.jetonVerification;
    if (!attendu) throw new NotFoundException();
    const a = Buffer.from(jeton ?? '');
    const b = Buffer.from(attendu);
    if (mode !== 'subscribe' || a.length !== b.length || !timingSafeEqual(a, b))
      throw new ForbiddenException('Jeton de vérification invalide.');
    return defi ?? '';
  }

  /** Messages reçus : signés par Meta avec le secret de l'application. */
  @Public()
  @Post()
  @HttpCode(200)
  async recevoir(
    @Req() requete: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() corps: unknown,
  ): Promise<void> {
    const secret = this.whatsapp.secretApplication;
    if (!secret) throw new NotFoundException();
    if (!signatureValide(requete.rawBody, signature, secret))
      throw new UnauthorizedException('Signature WhatsApp invalide.');

    // Toujours 200 une fois la signature vérifiée : sinon Meta renvoie la notification.
    for (const message of messagesRecus(corps)) {
      try {
        await this.connexion.recevoir(message);
      } catch (e) {
        this.logger.error(`Message WhatsApp non traité : ${String(e)}`);
      }
    }
  }
}
