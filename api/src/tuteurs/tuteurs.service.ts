import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { estDoublon } from '../common/erreurs-prisma.js';
import { page, sauter } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import { ActionAudit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreerTuteurDto,
  FiltreTuteursDto,
  ModifierTuteurDto,
} from './tuteurs.dto.js';

export const selectionTuteur = {
  id: true,
  prenoms: true,
  nom: true,
  contact1: true,
  contact2: true,
  email: true,
  langue: true,
} as const;

const CONTACT_DEJA_UTILISE =
  'Ce numéro (Contact_tuteur_1) est déjà celui d’un autre tuteur de l’école.';

/** Chaque mot recherché doit apparaître dans au moins un des champs. */
export function rechercheTuteur(q: string): Prisma.TuteurWhereInput[] {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => ({
      OR: [
        { nom: { contains: mot, mode: 'insensitive' } },
        { prenoms: { contains: mot, mode: 'insensitive' } },
        { contact1: { contains: mot.replace(/\s/g, '') } },
        { contact2: { contains: mot.replace(/\s/g, '') } },
        { email: { contains: mot, mode: 'insensitive' } },
      ],
    }));
}

@Injectable()
export class TuteursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lister(u: UtilisateurConnecte, filtre: FiltreTuteursDto) {
    const where: Prisma.TuteurWhereInput = {
      ecoleId: u.ecoleId,
      AND: filtre.q ? rechercheTuteur(filtre.q) : [],
    };
    const [tuteurs, total] = await this.prisma.$transaction([
      this.prisma.tuteur.findMany({
        where,
        select: { ...selectionTuteur, _count: { select: { eleves: true } } },
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
        ...sauter(filtre),
      }),
      this.prisma.tuteur.count({ where }),
    ]);
    return page(
      tuteurs.map(({ _count, ...t }) => ({
        ...t,
        nombreEleves: _count.eleves,
      })),
      total,
      filtre,
    );
  }

  async detail(u: UtilisateurConnecte, id: string) {
    const tuteur = await this.prisma.tuteur.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: {
        ...selectionTuteur,
        consentementLe: true,
        eleves: {
          select: {
            lien: true,
            principal: true,
            eleve: {
              select: {
                id: true,
                matricule: true,
                prenoms: true,
                nom: true,
                statut: true,
                classe: { select: { id: true, nom: true } },
              },
            },
          },
        },
      },
    });
    if (!tuteur) throw new NotFoundException('Tuteur introuvable.');
    return {
      ...tuteur,
      eleves: tuteur.eleves.map(({ eleve, lien, principal }) => ({
        ...eleve,
        lien,
        principal,
      })),
    };
  }

  async creer(u: UtilisateurConnecte, dto: CreerTuteurDto) {
    try {
      const tuteur = await this.prisma.tuteur.create({
        data: {
          prenoms: dto.prenoms,
          nom: dto.nom,
          contact1: dto.contact1,
          contact2: dto.contact2,
          email: dto.email,
          langue: dto.langue,
          ecoleId: u.ecoleId,
          creePar: u.id,
        },
        select: selectionTuteur,
      });
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Tuteur',
        tuteur.id,
      );
      return tuteur;
    } catch (e) {
      if (estDoublon(e)) throw new ConflictException(CONTACT_DEJA_UTILISE);
      throw e;
    }
  }

  async modifier(u: UtilisateurConnecte, id: string, dto: ModifierTuteurDto) {
    await this.detail(u, id);
    try {
      const tuteur = await this.prisma.tuteur.update({
        where: { id },
        data: dto,
        select: selectionTuteur,
      });
      await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Tuteur', id, {
        champs: Object.keys(dto),
      });
      return tuteur;
    } catch (e) {
      if (estDoublon(e)) throw new ConflictException(CONTACT_DEJA_UTILISE);
      throw e;
    }
  }
}
