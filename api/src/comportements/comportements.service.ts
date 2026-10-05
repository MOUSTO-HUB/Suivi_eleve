import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { page, sauter } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  Role,
  StatutEleve,
  StatutValidation,
  TypeComportement,
  TypeNotification,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  FiltreComportementsDto,
  RejeterComportementDto,
  SignalerComportementDto,
} from './comportements.dto.js';
import {
  erreurComportement,
  messagesComportement,
  statutInitial,
} from './comportements.regles.js';

const selection = {
  id: true,
  type: true,
  categorie: true,
  gravite: true,
  description: true,
  sanction: true,
  convocationLe: true,
  date: true,
  statut: true,
  valideLe: true,
  motifRejet: true,
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
  auteur: { select: { prenoms: true, nom: true, role: true } },
  validePar: { select: { prenoms: true, nom: true } },
} satisfies Prisma.ComportementSelect;

/** Comportements marquants : signalement, validation des cas graves, message aux familles. */
@Injectable()
export class ComportementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async signaler(u: UtilisateurConnecte, dto: SignalerComportementDto) {
    const erreur = erreurComportement(dto);
    if (erreur) throw new BadRequestException(erreur);
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: dto.eleveId, ecoleId: u.ecoleId, statut: StatutEleve.ACTIF },
      select: { id: true },
    });
    if (!eleve) throw new BadRequestException('Élève inconnu ou archivé.');

    const date = dto.date ? new Date(dto.date) : new Date();
    if (date.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException(
        'Les faits ne peuvent pas être dans le futur.',
      );
    }
    const convocationLe = dto.convocationLe
      ? new Date(dto.convocationLe)
      : null;
    if (convocationLe && convocationLe.getTime() < Date.now()) {
      throw new BadRequestException(
        'La convocation doit être à une date à venir.',
      );
    }
    const positif = dto.type === TypeComportement.POSITIF;
    const gravite = positif ? 1 : (dto.gravite ?? 1);
    const statut = statutInitial(dto.type, gravite, u.role);

    const comportement = await this.prisma.comportement.create({
      data: {
        eleveId: dto.eleveId,
        type: dto.type,
        categorie: dto.categorie,
        gravite,
        description: dto.description,
        sanction: positif ? null : dto.sanction,
        convocationLe: positif ? null : convocationLe,
        date,
        statut,
        auteurId: u.id,
        ...(statut === StatutValidation.VALIDE && u.role === Role.ADMIN
          ? { valideParId: u.id, valideLe: new Date() }
          : {}),
        creePar: u.id,
      },
      select: { id: true },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'Comportement',
      comportement.id,
      {
        type: dto.type,
        gravite,
      },
    );
    if (statut === StatutValidation.VALIDE)
      await this.prevenirFamille(u, comportement.id);
    return this.detail(u, comportement.id);
  }

  /** Validation d'un cas grave par la direction : la famille est alors prévenue. */
  async valider(u: UtilisateurConnecte, id: string) {
    await this.enAttente(u, id);
    await this.prisma.comportement.update({
      where: { id },
      data: {
        statut: StatutValidation.VALIDE,
        valideParId: u.id,
        valideLe: new Date(),
      },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Comportement',
      id,
      {
        valide: true,
      },
    );
    await this.prevenirFamille(u, id);
    return this.detail(u, id);
  }

  async rejeter(
    u: UtilisateurConnecte,
    id: string,
    dto: RejeterComportementDto,
  ) {
    await this.enAttente(u, id);
    await this.prisma.comportement.update({
      where: { id },
      data: {
        statut: StatutValidation.REJETE,
        valideParId: u.id,
        valideLe: new Date(),
        motifRejet: dto.motif,
      },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Comportement',
      id,
      {
        rejete: true,
      },
    );
    return this.detail(u, id);
  }

  /** Personnel : comportements de l'école. Parent : ceux de ses enfants, validés seulement. */
  async lister(u: UtilisateurConnecte, filtre: FiltreComportementsDto) {
    const parent = u.role === Role.PARENT;
    const where: Prisma.ComportementWhereInput = {
      eleve: {
        ecoleId: u.ecoleId,
        classeId: filtre.classeId,
        ...(parent
          ? { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } }
          : {}),
      },
      eleveId: filtre.eleveId,
      type: filtre.type,
      statut: parent ? StatutValidation.VALIDE : filtre.statut,
      ...(filtre.convocations ? { convocationLe: { gte: new Date() } } : {}),
    };
    const [comportements, total, aValider] = await this.prisma.$transaction([
      this.prisma.comportement.findMany({
        where,
        select: selection,
        orderBy: filtre.convocations
          ? { convocationLe: 'asc' }
          : [{ date: 'desc' }],
        ...sauter(filtre),
      }),
      this.prisma.comportement.count({ where }),
      this.prisma.comportement.count({
        where: {
          statut: StatutValidation.EN_ATTENTE,
          eleve: { ecoleId: u.ecoleId },
        },
      }),
    ]);
    return {
      ...page(comportements, total, filtre),
      aValider: parent ? 0 : aValider,
    };
  }

  async detail(u: UtilisateurConnecte, id: string) {
    const comportement = await this.prisma.comportement.findFirst({
      where: {
        id,
        eleve: {
          ecoleId: u.ecoleId,
          ...(u.role === Role.PARENT
            ? { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } }
            : {}),
        },
        ...(u.role === Role.PARENT ? { statut: StatutValidation.VALIDE } : {}),
      },
      select: selection,
    });
    if (!comportement) throw new NotFoundException('Comportement introuvable.');
    return comportement;
  }

  /** Saisie erronée. Si la famille a déjà été prévenue, le message n'est pas rappelé. */
  async supprimer(u: UtilisateurConnecte, id: string) {
    const comportement = await this.detail(u, id);
    await this.prisma.comportement.delete({ where: { id } });
    await this.audit.journaliser(
      u,
      ActionAudit.SUPPRESSION,
      'Comportement',
      id,
      {
        eleveId: comportement.eleve.id,
        statut: comportement.statut,
      },
    );
  }

  private async enAttente(u: UtilisateurConnecte, id: string) {
    const comportement = await this.detail(u, id);
    if (comportement.statut !== StatutValidation.EN_ATTENTE) {
      throw new BadRequestException(
        "Ce comportement n'attend pas de validation.",
      );
    }
  }

  private async prevenirFamille(u: UtilisateurConnecte, id: string) {
    const c = await this.prisma.comportement.findUniqueOrThrow({
      where: { id },
      include: { eleve: { select: { prenoms: true } } },
    });
    await this.notifications.notifier({
      ecoleId: u.ecoleId,
      type: TypeNotification.COMPORTEMENT,
      cible: { eleveIds: [c.eleveId] },
      variables: messagesComportement(c.eleve.prenoms, c),
      sourceType: 'comportement',
      sourceId: c.id,
      cleDeduplication: `comportement:${c.id}`,
      creePar: u.id,
    });
  }
}
