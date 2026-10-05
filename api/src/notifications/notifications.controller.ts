import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { PaginationDto } from '../common/pagination.js';
import { GESTION_SCOLARITE } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnvoiService } from './envoi.service.js';
import { ModelesService } from './modeles.service.js';
import {
  FiltreJournalDto,
  JetonPushDto,
  ModeleDto,
  ParamsModeleDto,
  PreferencesDto,
  StatistiquesDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

/** Statuts Twilio, Orange et Brevo → statut du journal. */
const STATUTS_TWILIO: Record<string, 'DELIVREE' | 'ECHOUEE'> = {
  delivered: 'DELIVREE',
  undelivered: 'ECHOUEE',
  failed: 'ECHOUEE',
};
const STATUTS_ORANGE: Record<string, 'DELIVREE' | 'ECHOUEE'> = {
  DeliveredToTerminal: 'DELIVREE',
  DeliveryImpossible: 'ECHOUEE',
};
const STATUTS_BREVO: Record<string, 'DELIVREE' | 'ECHOUEE'> = {
  delivered: 'DELIVREE',
  hard_bounce: 'ECHOUEE',
  invalid_email: 'ECHOUEE',
  blocked: 'ECHOUEE',
  error: 'ECHOUEE',
};

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly modeles: ModelesService,
    private readonly envoi: EnvoiService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Administration ────────────────────────────────────────────────────────

  @Get('journal')
  @Roles(...GESTION_SCOLARITE)
  journal(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreJournalDto,
  ) {
    return this.notifications.journal(u, filtre);
  }

  @Get('statistiques')
  @Roles(...GESTION_SCOLARITE, Role.COMPTABLE)
  statistiques(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() q: StatistiquesDto,
  ) {
    return this.notifications.statistiques(u, q.mois);
  }

  @Post(':id/renvoyer')
  @Roles(...GESTION_SCOLARITE)
  async renvoyer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const n = await this.prisma.notification.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: { id: true },
    });
    if (!n) throw new NotFoundException('Notification introuvable.');
    if (!(await this.envoi.renvoyer(id))) {
      throw new ForbiddenException(
        'Seule une notification en échec peut être renvoyée.',
      );
    }
    return { renvoyee: true };
  }

  @Get('modeles')
  @Roles(...GESTION_SCOLARITE)
  listerModeles(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.modeles.lister(u);
  }

  @Put('modeles/:type/:canal')
  @Roles(...GESTION_SCOLARITE)
  enregistrerModele(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param() p: ParamsModeleDto,
    @Body() dto: ModeleDto,
  ) {
    return this.modeles.enregistrer(u, p.type, p.canal, dto);
  }

  @Delete('modeles/:type/:canal')
  @Roles(...GESTION_SCOLARITE)
  reinitialiserModele(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param() p: ParamsModeleDto,
  ) {
    return this.modeles.reinitialiser(u, p.type, p.canal);
  }

  // ─── Parents ───────────────────────────────────────────────────────────────

  @Get('mes')
  @Roles(Role.PARENT)
  mesNotifications(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() p: PaginationDto,
  ) {
    return this.notifications.mesNotifications(u, p);
  }

  @Post(':id/lue')
  @Roles(Role.PARENT)
  @HttpCode(200)
  marquerLue(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.marquerLue(u, id);
  }

  @Get('preferences')
  @Roles(Role.PARENT)
  preferences(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.notifications.preferences(u);
  }

  @Put('preferences')
  @Roles(Role.PARENT)
  enregistrerPreferences(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: PreferencesDto,
  ) {
    return this.notifications.enregistrerPreferences(u, dto);
  }

  /** Enregistre le jeton push de l'appareil mobile de l'utilisateur. */
  @Post('jetons-push')
  @HttpCode(204)
  async enregistrerJetonPush(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: JetonPushDto,
  ) {
    await this.prisma.jetonPush.upsert({
      where: { jeton: dto.jeton },
      update: { utilisateurId: u.id, plateforme: dto.plateforme },
      create: {
        utilisateurId: u.id,
        jeton: dto.jeton,
        plateforme: dto.plateforme,
      },
    });
  }

  @Delete('jetons-push')
  @HttpCode(204)
  async supprimerJetonPush(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: Pick<JetonPushDto, 'jeton'>,
  ) {
    await this.prisma.jetonPush.deleteMany({
      where: { jeton: dto.jeton, utilisateurId: u.id },
    });
  }

  // ─── Accusés de livraison des fournisseurs (EF-83) ─────────────────────────
  // Protégés par le secret WEBHOOK_SECRET passé dans l'URL configurée chez le fournisseur.

  private verifierSecret(jeton?: string) {
    const attendu = this.config.get<string>('WEBHOOK_SECRET');
    const a = Buffer.from(jeton ?? '');
    const b = Buffer.from(attendu ?? '');
    if (!attendu || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Secret de webhook invalide.');
    }
  }

  @Public()
  @Post('webhooks/twilio')
  @HttpCode(204)
  async webhookTwilio(
    @Query('jeton') jeton: string | undefined,
    @Body()
    corps: { MessageSid?: string; MessageStatus?: string; ErrorCode?: string },
  ) {
    this.verifierSecret(jeton);
    const statut = STATUTS_TWILIO[corps.MessageStatus ?? ''];
    if (statut && corps.MessageSid) {
      await this.envoi.accuserReception(
        { reference: corps.MessageSid },
        statut,
        corps.ErrorCode ? `Twilio, code ${corps.ErrorCode}` : undefined,
      );
    }
  }

  @Public()
  @Post('webhooks/orange')
  @HttpCode(204)
  async webhookOrange(
    @Query('jeton') jeton: string | undefined,
    @Body()
    corps: {
      deliveryInfoNotification?: {
        callbackData?: string;
        deliveryInfo?: { deliveryStatus?: string };
      };
    },
  ) {
    this.verifierSecret(jeton);
    const info = corps.deliveryInfoNotification;
    const statut = STATUTS_ORANGE[info?.deliveryInfo?.deliveryStatus ?? ''];
    if (statut && info?.callbackData) {
      await this.envoi.accuserReception(
        { id: info.callbackData },
        statut,
        'Orange : non délivré.',
      );
    }
  }

  @Public()
  @Post('webhooks/brevo')
  @HttpCode(204)
  async webhookBrevo(
    @Query('jeton') jeton: string | undefined,
    @Body() corps: { event?: string; 'message-id'?: string; reason?: string },
  ) {
    this.verifierSecret(jeton);
    const statut = STATUTS_BREVO[corps.event ?? ''];
    const reference = corps['message-id'];
    if (statut && reference) {
      await this.envoi.accuserReception({ reference }, statut, corps.reason);
    }
  }
}
