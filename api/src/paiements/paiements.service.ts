import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { depuisJour, versJour } from '../common/dates.js';
import { page, sauter } from '../common/pagination.js';
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
  joursDeRetard,
  typeRappel,
  variablesPaiement,
} from './paiements.regles.js';

const selection = {
  id: true,
  libelle: true,
  montant: true,
  dateEcheance: true,
  statut: true,
  nombreEnvois: true,
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
});

/**
 * Rappels de paiement : la comptabilité reste dans les outils de l'école. Le
 * comptable signale un paiement en attente ; la famille est prévenue, avec le
 * retard calculé depuis la date de paiement normale.
 */
@Injectable()
export class PaiementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

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
    const autres = await this.prisma.rappelPaiement.findMany({
      where: {
        eleveId: rappel.eleve.id,
        statut: StatutRappel.EN_COURS,
        id: { not: id },
      },
      select: { montant: true },
    });
    const numero = rappel.nombreEnvois + 1;
    const { tuteurs } = await this.notifications.notifier({
      ecoleId: u.ecoleId,
      type: typeRappel(joursDeRetard(rappel.dateEcheance)),
      cible: { eleveIds: [rappel.eleve.id] },
      variables: variablesPaiement(rappel, autres),
      sourceType: 'rappel_paiement',
      sourceId: id,
      cleDeduplication: `rappel_paiement:${id}:${numero}`,
      creePar: u.id,
    });
    await this.prisma.rappelPaiement.update({
      where: { id },
      data: { nombreEnvois: numero, dernierEnvoiLe: new Date() },
    });
    return { ...(await this.detail(u, id)), famillesPrevenues: tuteurs };
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
