import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ClassesService } from '../classes/classes.service.js';
import { page, sauter } from '../common/pagination.js';
import { optionsFile, traitementActif } from '../common/redis.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  CanalNotification,
  CibleAnnonce,
  StatutAnnonce,
  StatutNotification,
  TypeAnnonce,
  TypeNotification,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  variablesEvenement,
  veilleA18h,
} from '../evenements/evenements.regles.js';
import type { CreerAnnonceDto, FiltreAnnoncesDto } from './annonces.dto.js';
import {
  erreurProgrammation,
  instantDakar,
  titreAnnonce,
  variablesAnnonce,
} from './annonces.regles.js';

const selectionAnnonce = {
  id: true,
  type: true,
  titre: true,
  message: true,
  motif: true,
  motifDetail: true,
  dateDebut: true,
  creneau: true,
  cible: true,
  statut: true,
  programmeeLe: true,
  envoyeeLe: true,
  creeLe: true,
  auteur: { select: { prenoms: true, nom: true } },
  classes: { select: { classe: { select: { id: true, nom: true } } } },
} satisfies Prisma.AnnonceSelect;

type AnnonceBrute = Prisma.AnnonceGetPayload<{
  select: typeof selectionAnnonce;
}>;

const formater = ({ classes, ...a }: AnnonceBrute) => ({
  ...a,
  classes: classes.map((c) => c.classe),
});

const TYPE_NOTIFICATION: Record<string, TypeNotification> = {
  PAS_DE_COURS: TypeNotification.PAS_DE_COURS,
  LIBERATION_ANTICIPEE: TypeNotification.LIBERATION_ANTICIPEE,
  EVENEMENT: TypeNotification.EVENEMENT,
};

/**
 * Absence de cours, libération anticipée et événements : envoi immédiat ou
 * programmé (file BullMQ différée), rappel des événements la veille à 18h,
 * suivi des envois et des lectures.
 */
@Injectable()
export class AnnoncesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnnoncesService.name);
  private file!: Queue;
  private travailleur?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.file = new Queue('annonces', {
      ...optionsFile(this.config),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
    if (!traitementActif(this.config)) return;
    this.travailleur = new Worker<{ annonceId: string }>(
      'annonces',
      (job) =>
        job.name === 'rappel'
          ? this.envoyerRappel(job.data.annonceId)
          : this.envoyer(job.data.annonceId),
      optionsFile(this.config),
    );
    this.travailleur.on('error', (e) =>
      this.logger.error(`File annonces : ${e.message}`),
    );

    // Reprogramme ce qui attendait (Redis vidé, redémarrage…) ; jobId = id de l'annonce.
    const enAttente = await this.prisma.annonce.findMany({
      where: { statut: StatutAnnonce.PROGRAMMEE },
      select: { id: true, programmeeLe: true },
    });
    for (const a of enAttente)
      await this.programmer(a.id, a.programmeeLe ?? new Date());
    const rappels = await this.prisma.annonce.findMany({
      where: {
        type: TypeAnnonce.EVENEMENT,
        statut: StatutAnnonce.ENVOYEE,
        rappelEnvoyeLe: null,
        dateDebut: { gt: new Date() },
      },
      select: { id: true, dateDebut: true },
    });
    for (const a of rappels) await this.programmerRappel(a.id, a.dateDebut);
  }

  async onModuleDestroy() {
    await this.travailleur?.close();
    await this.file?.close();
  }

  private async programmer(id: string, quand: Date) {
    await this.file.add(
      'envoi',
      { annonceId: id },
      { jobId: id, delay: Math.max(0, quand.getTime() - Date.now()) },
    );
  }

  /** Rappel la veille à 18h, sauf si ce moment est déjà passé. */
  private async programmerRappel(id: string, dateDebut: Date) {
    const delai = veilleA18h(dateDebut).getTime() - Date.now();
    if (delai <= 0) return;
    await this.file.add(
      'rappel',
      { annonceId: id },
      { jobId: `rappel-${id}`, delay: delai },
    );
  }

  /** Envoie tout de suite, ou programme l'envoi si une date est donnée. */
  async publier(id: string, programmeeLe: Date | null) {
    if (programmeeLe) await this.programmer(id, programmeeLe);
    else await this.envoyer(id);
  }

  async creer(u: UtilisateurConnecte, dto: CreerAnnonceDto) {
    const parClasses = dto.cible === CibleAnnonce.CLASSES;
    const classeIds = parClasses ? [...new Set(dto.classeIds ?? [])] : [];
    for (const id of classeIds)
      await this.classes.verifierClasse(u.ecoleId, id);
    const nomsClasses = parClasses
      ? (
          await this.prisma.classe.findMany({
            where: { id: { in: classeIds } },
            select: { nom: true },
            orderBy: { nom: 'asc' },
          })
        ).map((c) => c.nom)
      : null;

    const liberation = dto.type === TypeAnnonce.LIBERATION_ANTICIPEE;
    const dateDebut = instantDakar(
      dto.date,
      liberation ? dto.heure : undefined,
    );
    if (Number.isNaN(dateDebut.getTime()))
      throw new BadRequestException('Date invalide.');

    const programmeeLe = dto.programmeeLe ? new Date(dto.programmeeLe) : null;
    if (programmeeLe) {
      const erreur = erreurProgrammation(programmeeLe);
      if (erreur) throw new BadRequestException(erreur);
    }

    const annonce = await this.prisma.annonce.create({
      data: {
        ecoleId: u.ecoleId,
        type: dto.type,
        titre: titreAnnonce(dto.type, dateDebut, nomsClasses),
        message: dto.message ?? '',
        motif: dto.motif,
        motifDetail: dto.motifDetail,
        dateDebut,
        creneau: liberation ? null : (dto.creneau ?? 'toute la journée'),
        cible: dto.cible,
        statut: programmeeLe
          ? StatutAnnonce.PROGRAMMEE
          : StatutAnnonce.BROUILLON,
        programmeeLe,
        auteurId: u.id,
        creePar: u.id,
        classes: {
          create: classeIds.map((classeId) => ({ classeId, creePar: u.id })),
        },
      },
      select: { id: true },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'Annonce',
      annonce.id,
      {
        type: dto.type,
        programmee: Boolean(programmeeLe),
      },
    );

    await this.publier(annonce.id, programmeeLe);
    return this.detail(u, annonce.id);
  }

  /**
   * Prévient les familles. Idempotent : la clé de déduplication empêche un
   * second message au même tuteur si l'envoi est rejoué.
   */
  async envoyer(annonceId: string): Promise<void> {
    const annonce = await this.prisma.annonce.findUnique({
      where: { id: annonceId },
      include: { classes: { select: { classeId: true } } },
    });
    if (
      !annonce ||
      (annonce.statut !== StatutAnnonce.BROUILLON &&
        annonce.statut !== StatutAnnonce.PROGRAMMEE)
    ) {
      return;
    }
    await this.notifications.notifier({
      ecoleId: annonce.ecoleId,
      type: TYPE_NOTIFICATION[annonce.type],
      cible:
        annonce.cible === CibleAnnonce.ECOLE
          ? { ecole: true }
          : { classeIds: annonce.classes.map((c) => c.classeId) },
      variables:
        annonce.type === TypeAnnonce.EVENEMENT
          ? variablesEvenement(annonce, 'publication')
          : variablesAnnonce(annonce),
      sourceType: 'annonce',
      sourceId: annonce.id,
      cleDeduplication: `annonce:${annonce.id}`,
      creePar: annonce.auteurId ?? undefined,
    });
    await this.prisma.annonce.update({
      where: { id: annonce.id },
      data: { statut: StatutAnnonce.ENVOYEE, envoyeeLe: new Date() },
    });
    if (annonce.type === TypeAnnonce.EVENEMENT)
      await this.programmerRappel(annonce.id, annonce.dateDebut);
  }

  /** Rappel de la veille d'un événement envoyé et toujours maintenu. */
  async envoyerRappel(annonceId: string): Promise<void> {
    const annonce = await this.prisma.annonce.findUnique({
      where: { id: annonceId },
      include: { classes: { select: { classeId: true } } },
    });
    if (
      annonce?.type !== TypeAnnonce.EVENEMENT ||
      annonce.statut !== StatutAnnonce.ENVOYEE ||
      annonce.rappelEnvoyeLe
    ) {
      return;
    }
    await this.notifierEvenement(annonce, 'rappel');
    await this.prisma.annonce.update({
      where: { id: annonce.id },
      data: { rappelEnvoyeLe: new Date() },
    });
  }

  /**
   * Annule un événement : retire les envois en attente et, si les familles
   * avaient déjà été prévenues, les informe de l'annulation.
   */
  async annulerEvenement(u: UtilisateurConnecte, id: string) {
    const annonce = await this.prisma.annonce.findFirst({
      where: { id, ecoleId: u.ecoleId, type: TypeAnnonce.EVENEMENT },
      include: { classes: { select: { classeId: true } } },
    });
    if (!annonce) throw new NotFoundException('Événement introuvable.');
    if (annonce.statut === StatutAnnonce.ANNULEE)
      throw new BadRequestException('Cet événement est déjà annulé.');
    await this.file.remove(id);
    await this.file.remove(`rappel-${id}`);
    await this.prisma.annonce.update({
      where: { id },
      data: { statut: StatutAnnonce.ANNULEE },
    });
    const prevenues = annonce.statut === StatutAnnonce.ENVOYEE;
    if (prevenues) await this.notifierEvenement(annonce, 'annulation');
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Annonce', id, {
      annulee: true,
      famillesPrevenues: prevenues,
    });
  }

  private async notifierEvenement(
    annonce: Prisma.AnnonceGetPayload<{
      include: { classes: { select: { classeId: true } } };
    }>,
    moment: 'rappel' | 'annulation',
  ) {
    // Source distincte : le suivi de la publication ne compte pas ces messages.
    await this.notifications.notifier({
      ecoleId: annonce.ecoleId,
      type: TypeNotification.EVENEMENT,
      cible:
        annonce.cible === CibleAnnonce.ECOLE
          ? { ecole: true }
          : { classeIds: annonce.classes.map((c) => c.classeId) },
      variables: variablesEvenement(annonce, moment),
      sourceType: `annonce-${moment}`,
      sourceId: annonce.id,
      cleDeduplication: `evenement-${moment}:${annonce.id}`,
      creePar: annonce.auteurId ?? undefined,
    });
  }

  async annuler(u: UtilisateurConnecte, id: string) {
    await this.exigerProgrammee(u, id);
    await this.file.remove(id);
    await this.prisma.annonce.update({
      where: { id },
      data: { statut: StatutAnnonce.ANNULEE },
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Annonce', id, {
      annulee: true,
    });
    return this.detail(u, id);
  }

  async envoyerMaintenant(u: UtilisateurConnecte, id: string) {
    await this.exigerProgrammee(u, id);
    await this.file.remove(id);
    await this.envoyer(id);
    return this.detail(u, id);
  }

  private async exigerProgrammee(u: UtilisateurConnecte, id: string) {
    const annonce = await this.prisma.annonce.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: { statut: true },
    });
    if (!annonce) throw new NotFoundException('Annonce introuvable.');
    if (annonce.statut !== StatutAnnonce.PROGRAMMEE) {
      throw new BadRequestException(
        "Seule une annonce programmée, pas encore envoyée, peut l'être.",
      );
    }
  }

  async lister(u: UtilisateurConnecte, filtre: FiltreAnnoncesDto) {
    const where: Prisma.AnnonceWhereInput = {
      ecoleId: u.ecoleId,
      type: filtre.type ?? {
        in: [TypeAnnonce.PAS_DE_COURS, TypeAnnonce.LIBERATION_ANTICIPEE],
      },
      statut: filtre.statut,
    };
    const [annonces, total] = await this.prisma.$transaction([
      this.prisma.annonce.findMany({
        where,
        select: selectionAnnonce,
        orderBy: { creeLe: 'desc' },
        ...sauter(filtre),
      }),
      this.prisma.annonce.count({ where }),
    ]);
    // Familles prévenues et lectures, par annonce.
    const lectures = await this.prisma.notification.groupBy({
      by: ['sourceId', 'statut'],
      where: {
        sourceType: 'annonce',
        sourceId: { in: annonces.map((a) => a.id) },
        canal: CanalNotification.APPLICATION,
      },
      _count: { _all: true },
    });
    return page(
      annonces.map((a) => {
        const lignes = lectures.filter((l) => l.sourceId === a.id);
        return {
          ...formater(a),
          familles: lignes.reduce((s, l) => s + l._count._all, 0),
          lues:
            lignes.find((l) => l.statut === StatutNotification.LUE)?._count
              ._all ?? 0,
        };
      }),
      total,
      filtre,
    );
  }

  /** Annonce et suivi en temps réel : envois par canal, familles qui ont lu ou non (EF-32). */
  async detail(u: UtilisateurConnecte, id: string) {
    const annonce = await this.prisma.annonce.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: selectionAnnonce,
    });
    if (!annonce) throw new NotFoundException('Annonce introuvable.');
    return { ...formater(annonce), suivi: await this.suivi(id) };
  }

  /** Suivi des envois d'une annonce ou d'un événement. */
  async suivi(id: string) {
    const source = { sourceType: 'annonce', sourceId: id };
    const [groupes, nonLues] = await Promise.all([
      this.prisma.notification.groupBy({
        by: ['canal', 'statut'],
        where: source,
        _count: { _all: true },
      }),
      this.prisma.notification.findMany({
        where: { ...source, canal: CanalNotification.APPLICATION, lueLe: null },
        select: {
          tuteur: {
            select: { id: true, prenoms: true, nom: true, contact1: true },
          },
          eleve: {
            select: {
              id: true,
              prenoms: true,
              nom: true,
              classe: { select: { nom: true } },
            },
          },
        },
        orderBy: { tuteur: { nom: 'asc' } },
        take: 300,
      }),
    ]);

    const parCanal: Record<string, Record<string, number>> = {};
    for (const g of groupes) {
      parCanal[g.canal] ??= {};
      parCanal[g.canal][g.statut] = g._count._all;
    }
    const application = parCanal[CanalNotification.APPLICATION] ?? {};
    const familles = Object.values(application).reduce((s, n) => s + n, 0);
    const enCours = ['SMS', 'EMAIL', 'PUSH'].some(
      (c) => (parCanal[c]?.[StatutNotification.EN_FILE] ?? 0) > 0,
    );
    delete parCanal[CanalNotification.APPLICATION];

    return {
      familles,
      lues: application[StatutNotification.LUE] ?? 0,
      enCours,
      parCanal,
      nonLues: nonLues.map((n) => ({ tuteur: n.tuteur, eleve: n.eleve })),
    };
  }
}
