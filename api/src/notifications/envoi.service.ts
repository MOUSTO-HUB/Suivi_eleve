import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Queue,
  UnrecoverableError,
  Worker,
  type ConnectionOptions,
} from 'bullmq';
import {
  CanalNotification,
  StatutNotification,
  type PrioriteNotification,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CanauxService } from './canaux.service.js';
import {
  ErreurFournisseur,
  JetonPushInvalide,
  type ResultatEnvoi,
} from './fournisseurs/fournisseurs.js';
import { doitMettreAJour, PRIORITE_FILE } from './notifications.regles.js';

type CanalEnvoye = Exclude<CanalNotification, 'APPLICATION'>;
const CANAUX_ENVOYES: CanalEnvoye[] = ['SMS', 'EMAIL', 'PUSH'];

export interface NotificationAEnvoyer {
  id: string;
  canal: CanalNotification;
  priorite: PrioriteNotification;
}

/**
 * File d'envoi BullMQ (une file par canal, servie par priorité) et traitement :
 * 3 essais avec délai croissant, bascule sur Contact_tuteur_2 si le SMS échoue,
 * mise à jour du journal à chaque étape.
 */
@Injectable()
export class EnvoiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnvoiService.name);
  private readonly files = new Map<CanalEnvoye, Queue>();
  private readonly travailleurs: Worker[] = [];
  private readonly connexion: ConnectionOptions;
  private readonly prefixe: string;
  private readonly essais: number;
  private readonly delai: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly canaux: CanauxService,
    private readonly config: ConfigService,
  ) {
    this.connexion = {
      url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      maxRetriesPerRequest: null,
    };
    this.prefixe = config.get<string>('BULLMQ_PREFIXE', 'suivi');
    this.essais = Number(config.get('NOTIFICATIONS_ESSAIS', 3));
    this.delai = Number(config.get('NOTIFICATIONS_DELAI_ESSAI_MS', 30_000));
  }

  async onModuleInit() {
    for (const canal of CANAUX_ENVOYES) {
      const nom = `notifications-${canal.toLowerCase()}`;
      this.files.set(
        canal,
        new Queue(nom, {
          connection: this.connexion,
          prefix: this.prefixe,
          defaultJobOptions: {
            attempts: this.essais,
            backoff: { type: 'exponential', delay: this.delai },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        }),
      );
      // Le traitement peut tourner dans un processus séparé (NOTIFICATIONS_TRAITEMENT=non).
      if (
        this.config.get<string>('NOTIFICATIONS_TRAITEMENT', 'oui') !== 'non'
      ) {
        const travailleur = new Worker<{ notificationId: string }>(
          nom,
          (job) =>
            this.traiter(
              job.data.notificationId,
              job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
            ),
          { connection: this.connexion, prefix: this.prefixe, concurrency: 5 },
        );
        travailleur.on('error', (e) =>
          this.logger.error(`File ${nom} : ${e.message}`),
        );
        this.travailleurs.push(travailleur);
      }
    }
    if (this.travailleurs.length) await this.reprendreEnAttente();
  }

  async onModuleDestroy() {
    await Promise.all(this.travailleurs.map((t) => t.close()));
    await Promise.all([...this.files.values()].map((f) => f.close()));
  }

  /** Met des notifications dans leur file ; l'id sert d'identifiant de tâche (pas de doublon). */
  async ajouter(notifications: NotificationAEnvoyer[]): Promise<void> {
    await Promise.all(
      notifications
        .filter(
          (n): n is NotificationAEnvoyer & { canal: CanalEnvoye } =>
            n.canal !== 'APPLICATION',
        )
        .map((n) =>
          this.files
            .get(n.canal)!
            .add(
              'envoi',
              { notificationId: n.id },
              { jobId: n.id, priority: PRIORITE_FILE[n.priorite] },
            ),
        ),
    );
  }

  /** Au démarrage : remet en file ce qui attendait encore (Redis indisponible, redémarrage…). */
  private async reprendreEnAttente() {
    const enAttente = await this.prisma.notification.findMany({
      where: {
        statut: StatutNotification.EN_FILE,
        canal: { not: CanalNotification.APPLICATION },
        creeLe: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
      select: { id: true, canal: true, priorite: true },
      take: 5000,
    });
    if (enAttente.length) {
      this.logger.log(
        `${enAttente.length} notification(s) en attente remise(s) en file.`,
      );
      await this.ajouter(enAttente);
    }
  }

  /** Un essai d'envoi. `dernierEssai` : en cas d'échec, la notification est abandonnée. */
  async traiter(notificationId: string, dernierEssai: boolean): Promise<void> {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!n || n.statut !== StatutNotification.EN_FILE) return;

    try {
      const resultat = await this.envoyer(n);
      await this.prisma.notification.update({
        where: { id: n.id },
        data: {
          statut: StatutNotification.ENVOYEE,
          envoyeeLe: new Date(),
          fournisseur: resultat.fournisseur,
          referenceFournisseur: resultat.reference,
          cout: resultat.cout,
          essais: { increment: 1 },
          erreur: null,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const definitive = e instanceof ErreurFournisseur && e.definitive;
      const abandon = definitive || dernierEssai;
      await this.prisma.notification.update({
        where: { id: n.id },
        data: {
          essais: { increment: 1 },
          erreur: message.slice(0, 1000),
          statut: abandon
            ? StatutNotification.ECHOUEE
            : StatutNotification.EN_FILE,
        },
      });
      if (e instanceof JetonPushInvalide) {
        await this.prisma.jetonPush.deleteMany({
          where: { jeton: n.destinataire },
        });
      }
      if (abandon) {
        this.logger.warn(
          `Notification ${n.id} (${n.canal}) abandonnée : ${message}`,
        );
        await this.basculerSurContact2(n.id);
      }
      throw definitive ? new UnrecoverableError(message) : e;
    }
  }

  private envoyer(n: {
    id: string;
    canal: CanalNotification;
    destinataire: string;
    sujet: string | null;
    contenu: string;
    type: string;
    lotId: string;
  }): Promise<ResultatEnvoi> {
    switch (n.canal) {
      case CanalNotification.SMS:
        return this.canaux.envoyerSms(n.destinataire, n.contenu, n.id);
      case CanalNotification.EMAIL:
        return this.canaux.envoyerEmail(
          n.destinataire,
          n.sujet ?? 'Suivi_eleve',
          n.contenu,
          n.id,
        );
      case CanalNotification.PUSH:
        return this.canaux.envoyerPush(
          n.destinataire,
          n.sujet ?? 'Suivi_eleve',
          n.contenu,
          {
            notificationId: n.id,
            lotId: n.lotId,
            type: n.type,
          },
        );
      default:
        return Promise.resolve({ fournisseur: 'application' });
    }
  }

  /**
   * SMS abandonné vers Contact_tuteur_1 : le même message part vers
   * Contact_tuteur_2 s'il existe (cahier des charges, EF-82).
   */
  private async basculerSurContact2(notificationId: string): Promise<void> {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { tuteur: { select: { contact1: true, contact2: true } } },
    });
    if (
      !n ||
      n.canal !== CanalNotification.SMS ||
      !n.tuteur.contact2 ||
      n.destinataire !== n.tuteur.contact1 ||
      n.tuteur.contact2 === n.tuteur.contact1
    ) {
      return;
    }
    const copie = await this.prisma.notification.create({
      data: {
        lotId: n.lotId,
        ecoleId: n.ecoleId,
        type: n.type,
        priorite: n.priorite,
        canal: n.canal,
        tuteurId: n.tuteurId,
        eleveId: n.eleveId,
        destinataire: n.tuteur.contact2,
        sujet: n.sujet,
        contenu: n.contenu,
        sourceType: n.sourceType,
        sourceId: n.sourceId,
        creePar: n.creePar,
      },
      select: { id: true, canal: true, priorite: true },
    });
    this.logger.log(
      `SMS ${n.id} : bascule sur Contact_tuteur_2 (${copie.id}).`,
    );
    await this.ajouter([copie]);
  }

  /** Remet en file une notification échouée (bouton « Renvoyer » du journal). */
  async renvoyer(notificationId: string): Promise<boolean> {
    const { count } = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        statut: StatutNotification.ECHOUEE,
        canal: { not: CanalNotification.APPLICATION },
      },
      data: { statut: StatutNotification.EN_FILE, erreur: null },
    });
    if (!count) return false;
    const n = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      select: { id: true, canal: true, priorite: true },
    });
    // Nouvel identifiant de tâche : l'ancienne est peut-être encore gardée en échec par BullMQ.
    await this.files
      .get(n.canal as CanalEnvoye)!
      .add(
        'envoi',
        { notificationId: n.id },
        { jobId: `${n.id}-${Date.now()}`, priority: PRIORITE_FILE[n.priorite] },
      );
    return true;
  }

  /** Accusé de livraison d'un fournisseur (webhook). */
  async accuserReception(
    critere: { reference: string } | { id: string },
    statut: 'DELIVREE' | 'ECHOUEE',
    detail?: string,
  ): Promise<boolean> {
    const n = await this.prisma.notification.findFirst({
      where:
        'id' in critere
          ? { id: critere.id }
          : { referenceFournisseur: critere.reference },
    });
    if (!n || !doitMettreAJour(n.statut, statut)) return false;
    await this.prisma.notification.update({
      where: { id: n.id },
      data:
        statut === 'DELIVREE'
          ? { statut, delivreeLe: new Date() }
          : {
              statut,
              erreur: detail ?? 'Non délivré (accusé du fournisseur).',
            },
    });
    if (statut === 'ECHOUEE') await this.basculerSurContact2(n.id);
    return true;
  }
}
