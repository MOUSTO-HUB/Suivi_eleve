import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  CanalNotification,
  PrioriteNotification,
  type TypeNotification,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DemandeNotification {
  ecoleId: string;
  eleveId: string;
  type: TypeNotification;
  priorite?: PrioriteNotification;
  /** Objet de l'email. */
  sujet: string;
  /** Texte complet (email, application). */
  message: string;
  /** Texte court pour le SMS (160 caractères). */
  messageSms?: string;
  canaux: CanalNotification[];
  sourceType?: string;
  sourceId?: string;
}

/**
 * Met en file les notifications destinées aux tuteurs d'un élève : une ligne par
 * tuteur et par canal joignable (statut EN_FILE). L'envoi réel par SMS, email et
 * push sera assuré par le moteur de notifications (prompt 6), qui lit cette file.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifierTuteurs(demande: DemandeNotification): Promise<number> {
    const liens = await this.prisma.eleveTuteur.findMany({
      where: { eleveId: demande.eleveId },
      select: {
        tuteur: {
          select: {
            id: true,
            contact1: true,
            email: true,
            utilisateur: {
              select: { jetonsPush: { select: { jeton: true } } },
            },
          },
        },
      },
    });

    const lignes: Prisma.NotificationCreateManyInput[] = [];
    for (const { tuteur } of liens) {
      const destinataires: [CanalNotification, string, string][] = [];
      if (demande.canaux.includes(CanalNotification.SMS)) {
        destinataires.push([
          CanalNotification.SMS,
          tuteur.contact1,
          (demande.messageSms ?? demande.message).slice(0, 160),
        ]);
      }
      if (demande.canaux.includes(CanalNotification.EMAIL) && tuteur.email) {
        destinataires.push([
          CanalNotification.EMAIL,
          tuteur.email,
          demande.message,
        ]);
      }
      if (demande.canaux.includes(CanalNotification.PUSH)) {
        for (const { jeton } of tuteur.utilisateur?.jetonsPush ?? []) {
          destinataires.push([CanalNotification.PUSH, jeton, demande.message]);
        }
      }
      for (const [canal, destinataire, contenu] of destinataires) {
        lignes.push({
          ecoleId: demande.ecoleId,
          eleveId: demande.eleveId,
          tuteurId: tuteur.id,
          type: demande.type,
          priorite: demande.priorite ?? PrioriteNotification.NORMALE,
          canal,
          destinataire,
          sujet: canal === CanalNotification.EMAIL ? demande.sujet : null,
          contenu,
          sourceType: demande.sourceType,
          sourceId: demande.sourceId,
        });
      }
    }

    if (lignes.length)
      await this.prisma.notification.createMany({ data: lignes });
    this.logger.log(
      `${lignes.length} notification(s) ${demande.type} en file pour l'élève ${demande.eleveId}`,
    );
    return lignes.length;
  }
}
