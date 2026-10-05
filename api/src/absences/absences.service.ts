import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { jourFr } from '../annonces/annonces.regles.js';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { depuisJour, versJour } from '../common/dates.js';
import { page, sauter } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  Role,
  StatutEleve,
  TypeNotification,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  FiltreAbsencesDto,
  JustifierAbsenceDto,
  SignalerAbsencesDto,
} from './absences.dto.js';

const selectionAbsence = {
  id: true,
  date: true,
  creneau: true,
  matiere: true,
  justifiee: true,
  motif: true,
  justificationParent: true,
  justifieeLe: true,
  creeLe: true,
  eleve: {
    select: {
      id: true,
      matricule: true,
      prenoms: true,
      nom: true,
      classe: { select: { id: true, nom: true } },
    },
  },
  signalePar: { select: { prenoms: true, nom: true, role: true } },
  justifieePar: { select: { prenoms: true, nom: true } },
} satisfies Prisma.AbsenceSelect;

type AbsenceBrute = Prisma.AbsenceGetPayload<{
  select: typeof selectionAbsence;
}>;
const formater = (a: AbsenceBrute) => ({ ...a, date: versJour(a.date) });

/** Absences relevées à l'appel ; une absence non justifiée prévient la famille aussitôt. */
@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async signaler(u: UtilisateurConnecte, dto: SignalerAbsencesDto) {
    const date = depuisJour(dto.date);
    if (Number.isNaN(date.getTime()) || versJour(date) !== dto.date) {
      throw new BadRequestException('Date invalide.');
    }
    if (dto.date > versJour(new Date())) {
      throw new BadRequestException(
        "On ne peut pas noter une absence à l'avance.",
      );
    }
    const eleveIds = [...new Set(dto.eleveIds)];
    const eleves = await this.prisma.eleve.findMany({
      where: {
        id: { in: eleveIds },
        ecoleId: u.ecoleId,
        statut: StatutEleve.ACTIF,
      },
      select: { id: true },
    });
    if (eleves.length !== eleveIds.length) {
      throw new BadRequestException('Élève inconnu ou archivé dans la liste.');
    }

    const justifiee = Boolean(dto.justifiee);
    // Une absence déjà notée pour ce créneau n'est ni dupliquée ni signalée une seconde fois.
    const creees = await this.prisma.absence.createManyAndReturn({
      data: eleveIds.map((eleveId) => ({
        eleveId,
        date,
        creneau: dto.creneau,
        matiere: dto.matiere,
        justifiee,
        motif: justifiee ? dto.motif : undefined,
        justifieeLe: justifiee ? new Date() : undefined,
        justifieeParId: justifiee ? u.id : undefined,
        signaleParId: u.id,
        creePar: u.id,
      })),
      skipDuplicates: true,
      select: { id: true, eleveId: true },
    });

    if (!justifiee) {
      for (const absence of creees) {
        await this.notifications.notifier({
          ecoleId: u.ecoleId,
          type: TypeNotification.ABSENCE,
          cible: { eleveIds: [absence.eleveId] },
          variables: {
            date: jourFr(date),
            creneau: dto.creneau,
            matiere: dto.matiere ? `, ${dto.matiere}` : '',
          },
          sourceType: 'absence',
          sourceId: absence.id,
          cleDeduplication: `absence:${absence.id}`,
          creePar: u.id,
        });
      }
    }
    if (creees.length) {
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Absence',
        undefined,
        {
          date: dto.date,
          creneau: dto.creneau,
          nombre: creees.length,
        },
      );
    }
    return {
      creees: creees.length,
      dejaNotees: eleveIds.length - creees.length,
      famillesPrevenues: justifiee ? 0 : creees.length,
    };
  }

  /** Personnel : absences de l'école. Parent : celles de ses enfants. */
  async lister(u: UtilisateurConnecte, filtre: FiltreAbsencesDto) {
    const where: Prisma.AbsenceWhereInput = {
      eleve: {
        ecoleId: u.ecoleId,
        classeId: filtre.classeId,
        ...(u.role === Role.PARENT
          ? { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } }
          : {}),
      },
      eleveId: filtre.eleveId,
      justifiee: filtre.justifiee,
      date: {
        gte: filtre.du ? depuisJour(filtre.du) : undefined,
        lte: filtre.au ? depuisJour(filtre.au) : undefined,
      },
    };
    const [absences, total, nonJustifiees] = await this.prisma.$transaction([
      this.prisma.absence.findMany({
        where,
        select: selectionAbsence,
        orderBy: [{ date: 'desc' }, { creeLe: 'desc' }],
        ...sauter(filtre),
      }),
      this.prisma.absence.count({ where }),
      this.prisma.absence.count({ where: { ...where, justifiee: false } }),
    ]);
    return { ...page(absences.map(formater), total, filtre), nonJustifiees };
  }

  async justifier(
    u: UtilisateurConnecte,
    id: string,
    dto: JustifierAbsenceDto,
  ) {
    await this.trouver(u, id);
    const absence = await this.prisma.absence.update({
      where: { id },
      data: {
        justifiee: true,
        motif: dto.motif,
        justifieeLe: new Date(),
        justifieeParId: u.id,
      },
      select: selectionAbsence,
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Absence', id, {
      justifiee: true,
    });
    return formater(absence);
  }

  /** Le parent transmet un motif ; la vie scolaire décide ensuite de justifier. */
  async justificationParent(
    u: UtilisateurConnecte,
    id: string,
    dto: JustifierAbsenceDto,
  ) {
    await this.trouver(u, id);
    const absence = await this.prisma.absence.update({
      where: { id },
      data: { justificationParent: dto.motif },
      select: selectionAbsence,
    });
    return formater(absence);
  }

  /** Absence saisie par erreur. */
  async supprimer(u: UtilisateurConnecte, id: string) {
    const absence = await this.trouver(u, id);
    await this.prisma.absence.delete({ where: { id } });
    await this.audit.journaliser(u, ActionAudit.SUPPRESSION, 'Absence', id, {
      eleveId: absence.eleve.id,
      date: versJour(absence.date),
      creneau: absence.creneau,
    });
  }

  /** Absence de l'école ; pour un parent, seulement celles de ses enfants. */
  private async trouver(u: UtilisateurConnecte, id: string) {
    const absence = await this.prisma.absence.findFirst({
      where: {
        id,
        eleve: {
          ecoleId: u.ecoleId,
          ...(u.role === Role.PARENT
            ? { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } }
            : {}),
        },
      },
      select: selectionAbsence,
    });
    if (!absence) throw new NotFoundException('Absence introuvable.');
    return absence;
  }
}
