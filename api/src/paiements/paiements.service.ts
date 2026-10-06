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
import { depuisJour, versJour } from '../common/dates.js';
import { page, sauter } from '../common/pagination.js';
import { PAYS } from '../common/pays.js';
import { optionsFile, traitementActif } from '../common/redis.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  Role,
  StatutEleve,
  StatutRappel,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreerRappelDto, FiltreRappelsDto } from './paiements.dto.js';
import {
  doitRelancer,
  joursDeRetard,
  JOURS_RAPPEL_AVANT,
  prochaineRelanceAuto,
  typeRappel,
  variablesPaiement,
} from './paiements.regles.js';

/** Relances automatiques : chaque jour à 9h, heure de Dakar. */
const HORAIRE_RELANCES = '0 9 * * *';

const selection = {
  id: true,
  libelle: true,
  montant: true,
  dateEcheance: true,
  statut: true,
  nombreEnvois: true,
  relancesAuto: true,
  dernierEnvoiLe: true,
  regleLe: true,
  creeLe: true,
  eleve: {
    select: {
      id: true,
      prenoms: true,
      nom: true,
      matricule: true,
      classe: { select: { id: true, nom: true } },
    },
  },
  auteur: { select: { prenoms: true, nom: true } },
} satisfies Prisma.RappelPaiementSelect;

type RappelBrut = Prisma.RappelPaiementGetPayload<{ select: typeof selection }>;

/** Le retard est recalculé à chaque lecture : il « court » tant que rien n'est réglé. */
const formater = (r: RappelBrut) => ({
  ...r,
  dateEcheance: versJour(r.dateEcheance),
  joursRetard:
    r.statut === StatutRappel.EN_COURS
      ? Math.max(0, joursDeRetard(r.dateEcheance))
      : 0,
  prochaineRelanceAuto: (() => {
    const jour = prochaineRelanceAuto(r);
    return jour ? versJour(jour) : null;
  })(),
});

/**
 * Rappels de paiement : la comptabilité reste dans les outils de l'école. Le
 * comptable signale un paiement en attente ; la famille est prévenue, avec le
 * retard calculé depuis la date de paiement normale, puis relancée
 * automatiquement chaque jour où la règle `doitRelancer` le prévoit.
 */
@Injectable()
export class PaiementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaiementsService.name);
  private file?: Queue;
  private travailleur?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (!traitementActif(this.config)) return;
    this.file = new Queue('paiements', optionsFile(this.config));
    // Une seule tâche planifiée, même avec plusieurs instances de l'API.
    await this.file.upsertJobScheduler(
      'relances-quotidiennes',
      { pattern: HORAIRE_RELANCES, tz: 'Africa/Dakar' },
      { name: 'relances', opts: { removeOnComplete: 30, removeOnFail: 100 } },
    );
    this.travailleur = new Worker(
      'paiements',
      () => this.relancerAutomatiquement(),
      optionsFile(this.config),
    );
    this.travailleur.on('error', (e) =>
      this.logger.error(`File paiements : ${e.message}`),
    );
  }

  async onModuleDestroy() {
    await this.travailleur?.close();
    await this.file?.close();
  }

  /**
   * Tâche quotidienne : rappel 3 jours avant la date, puis relances après la
   * date (lendemain, puis toutes les semaines, 4 au plus). Rend le nombre de
   * familles relancées. `ecoleId` limite la relance à une école (tests).
   */
  async relancerAutomatiquement(
    aujourdHui = new Date(),
    ecoleId?: string,
  ): Promise<number> {
    const horizon = new Date(
      depuisJour(versJour(aujourdHui)).getTime() +
        JOURS_RAPPEL_AVANT * 24 * 3600 * 1000,
    );
    const candidats = await this.prisma.rappelPaiement.findMany({
      where: {
        statut: StatutRappel.EN_COURS,
        dateEcheance: { lte: horizon },
        eleve: { statut: StatutEleve.ACTIF, ecoleId },
      },
      select: {
        id: true,
        statut: true,
        dateEcheance: true,
        dernierEnvoiLe: true,
        relancesAuto: true,
        eleve: { select: { ecoleId: true } },
      },
    });
    let relances = 0;
    for (const r of candidats.filter((c) => doitRelancer(c, aujourdHui))) {
      try {
        await this.prevenir(r.id, r.eleve.ecoleId, null, aujourdHui, {
          automatique: joursDeRetard(r.dateEcheance, aujourdHui) > 0,
        });
        relances++;
      } catch (e) {
        this.logger.error(
          `Relance automatique du rappel ${r.id} : ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    if (relances)
      this.logger.log(`${relances} relance(s) de paiement automatique(s).`);
    return relances;
  }

  async creer(u: UtilisateurConnecte, dto: CreerRappelDto) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: dto.eleveId, ecoleId: u.ecoleId, statut: StatutEleve.ACTIF },
      select: { id: true },
    });
    if (!eleve) throw new BadRequestException('Élève inconnu ou archivé.');
    const dateEcheance = depuisJour(dto.dateEcheance);
    if (
      Number.isNaN(dateEcheance.getTime()) ||
      versJour(dateEcheance) !== dto.dateEcheance
    ) {
      throw new BadRequestException('Date de paiement invalide.');
    }
    if (joursDeRetard(dateEcheance) > 366) {
      throw new BadRequestException(
        'La date de paiement remonte à plus d’un an : vérifiez-la.',
      );
    }

    const rappel = await this.prisma.rappelPaiement.create({
      data: {
        eleveId: dto.eleveId,
        libelle: dto.libelle,
        montant: dto.montant,
        dateEcheance,
        auteurId: u.id,
        creePar: u.id,
      },
      select: { id: true },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'RappelPaiement',
      rappel.id,
      {
        montant: dto.montant,
      },
    );
    return this.envoyer(u, rappel.id);
  }

  /** Prévient la famille, avec le retard du jour. Chaque relance est un nouveau message. */
  async envoyer(u: UtilisateurConnecte, id: string) {
    const rappel = await this.trouver(u, id);
    if (rappel.statut !== StatutRappel.EN_COURS) {
      throw new BadRequestException('Ce paiement est déjà marqué réglé.');
    }
    const tuteurs = await this.prevenir(id, u.ecoleId, u.id);
    return { ...(await this.detail(u, id)), famillesPrevenues: tuteurs };
  }

  /**
   * Message à la famille (rappel ou retard selon le jour), avec le total des
   * autres paiements en attente de l'élève. Rend le nombre de tuteurs prévenus.
   */
  private async prevenir(
    id: string,
    ecoleId: string,
    creePar: string | null,
    aujourdHui = new Date(),
    { automatique = false } = {},
  ): Promise<number> {
    const rappel = await this.prisma.rappelPaiement.findUniqueOrThrow({
      where: { id },
      select: {
        libelle: true,
        montant: true,
        dateEcheance: true,
        nombreEnvois: true,
        eleveId: true,
        eleve: { select: { ecole: { select: { pays: true } } } },
      },
    });
    const autres = await this.prisma.rappelPaiement.findMany({
      where: {
        eleveId: rappel.eleveId,
        statut: StatutRappel.EN_COURS,
        id: { not: id },
      },
      select: { montant: true },
    });
    const numero = rappel.nombreEnvois + 1;
    const { tuteurs } = await this.notifications.notifier({
      ecoleId,
      type: typeRappel(joursDeRetard(rappel.dateEcheance, aujourdHui)),
      cible: { eleveIds: [rappel.eleveId] },
      variables: variablesPaiement(
        rappel,
        autres,
        PAYS[rappel.eleve.ecole.pays].monnaie,
        aujourdHui,
      ),
      sourceType: 'rappel_paiement',
      sourceId: id,
      cleDeduplication: `rappel_paiement:${id}:${numero}`,
      creePar: creePar ?? undefined,
    });
    await this.prisma.rappelPaiement.update({
      where: { id },
      data: {
        nombreEnvois: numero,
        dernierEnvoiLe: aujourdHui,
        ...(automatique ? { relancesAuto: { increment: 1 } } : {}),
      },
    });
    return tuteurs;
  }

  /** Paiement constaté par le comptable : plus aucune relance. */
  async regler(u: UtilisateurConnecte, id: string) {
    const rappel = await this.trouver(u, id);
    if (rappel.statut === StatutRappel.REGLE) {
      throw new BadRequestException('Ce paiement est déjà marqué réglé.');
    }
    await this.prisma.rappelPaiement.update({
      where: { id },
      data: { statut: StatutRappel.REGLE, regleLe: new Date() },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'RappelPaiement',
      id,
      {
        regle: true,
      },
    );
    return this.detail(u, id);
  }

  async supprimer(u: UtilisateurConnecte, id: string) {
    await this.trouver(u, id);
    await this.prisma.rappelPaiement.delete({ where: { id } });
    await this.audit.journaliser(
      u,
      ActionAudit.SUPPRESSION,
      'RappelPaiement',
      id,
    );
  }

  /** Comptabilité : tous les rappels. Parent : les paiements en attente de ses enfants. */
  async lister(u: UtilisateurConnecte, filtre: FiltreRappelsDto) {
    const parent = u.role === Role.PARENT;
    const where: Prisma.RappelPaiementWhereInput = {
      eleve: {
        ecoleId: u.ecoleId,
        classeId: filtre.classeId,
        ...(parent
          ? { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } }
          : {}),
      },
      eleveId: filtre.eleveId,
      statut: parent ? StatutRappel.EN_COURS : filtre.statut,
    };
    const enCours = { ...where, statut: StatutRappel.EN_COURS };
    const [rappels, total, somme, eleves] = await this.prisma.$transaction([
      this.prisma.rappelPaiement.findMany({
        where,
        select: selection,
        orderBy: [{ statut: 'asc' }, { dateEcheance: 'asc' }],
        ...sauter(filtre),
      }),
      this.prisma.rappelPaiement.count({ where }),
      this.prisma.rappelPaiement.aggregate({
        where: enCours,
        _sum: { montant: true },
      }),
      this.prisma.rappelPaiement.groupBy({
        by: ['eleveId'],
        where: enCours,
        orderBy: { eleveId: 'asc' },
      }),
    ]);
    return {
      ...page(rappels.map(formater), total, filtre),
      enAttente: { montant: somme._sum.montant ?? 0, eleves: eleves.length },
    };
  }

  async detail(u: UtilisateurConnecte, id: string) {
    return formater(await this.trouver(u, id));
  }

  private async trouver(u: UtilisateurConnecte, id: string) {
    const rappel = await this.prisma.rappelPaiement.findFirst({
      where: {
        id,
        eleve: {
          ecoleId: u.ecoleId,
          ...(u.role === Role.PARENT
            ? { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } }
            : {}),
        },
      },
      select: selection,
    });
    if (!rappel) throw new NotFoundException('Rappel introuvable.');
    return rappel;
  }
}
