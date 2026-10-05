import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { estDoublon } from '../common/erreurs-prisma.js';
import { ActionAudit, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreerMatiereDto,
  EnseignementsDto,
  ModifierMatiereDto,
} from './matieres.dto.js';

const selectionMatiere = { id: true, nom: true, coefficient: true } as const;
const formaterMatiere = (m: {
  id: string;
  nom: string;
  coefficient: { toNumber(): number };
}) => ({
  ...m,
  coefficient: m.coefficient.toNumber(),
});

@Injectable()
export class MatieresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lister(u: UtilisateurConnecte) {
    const matieres = await this.prisma.matiere.findMany({
      where: { ecoleId: u.ecoleId },
      select: selectionMatiere,
      orderBy: { nom: 'asc' },
    });
    return matieres.map(formaterMatiere);
  }

  async creer(u: UtilisateurConnecte, dto: CreerMatiereDto) {
    try {
      const matiere = await this.prisma.matiere.create({
        data: {
          ecoleId: u.ecoleId,
          nom: dto.nom,
          coefficient: dto.coefficient ?? 1,
          creePar: u.id,
        },
        select: selectionMatiere,
      });
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Matiere',
        matiere.id,
      );
      return formaterMatiere(matiere);
    } catch (e) {
      if (estDoublon(e))
        throw new ConflictException(`La matière « ${dto.nom} » existe déjà.`);
      throw e;
    }
  }

  async modifier(u: UtilisateurConnecte, id: string, dto: ModifierMatiereDto) {
    await this.trouverMatiere(u.ecoleId, id);
    try {
      const matiere = await this.prisma.matiere.update({
        where: { id },
        data: { nom: dto.nom, coefficient: dto.coefficient },
        select: selectionMatiere,
      });
      return formaterMatiere(matiere);
    } catch (e) {
      if (estDoublon(e))
        throw new ConflictException('Une matière porte déjà ce nom.');
      throw e;
    }
  }

  async enseignements(u: UtilisateurConnecte, classeId: string) {
    await this.trouverClasse(u.ecoleId, classeId);
    const enseignements = await this.prisma.enseignement.findMany({
      where: { classeId },
      select: {
        matiere: { select: selectionMatiere },
        enseignant: { select: { id: true, prenoms: true, nom: true } },
      },
      orderBy: { matiere: { nom: 'asc' } },
    });
    return enseignements.map((e) => ({
      ...e,
      matiere: formaterMatiere(e.matiere),
    }));
  }

  /** Remplace la liste des matières enseignées dans la classe et leurs professeurs. */
  async definirEnseignements(
    u: UtilisateurConnecte,
    classeId: string,
    dto: EnseignementsDto,
  ) {
    await this.trouverClasse(u.ecoleId, classeId);
    const matiereIds = dto.enseignements.map((e) => e.matiereId);
    if (new Set(matiereIds).size !== matiereIds.length) {
      throw new BadRequestException('Une matière est indiquée deux fois.');
    }
    for (const id of matiereIds) await this.trouverMatiere(u.ecoleId, id);
    const enseignants = [
      ...new Set(
        dto.enseignements
          .map((e) => e.enseignantId)
          .filter((id): id is string => !!id),
      ),
    ];
    const valides = await this.prisma.utilisateur.count({
      where: {
        id: { in: enseignants },
        ecoleId: u.ecoleId,
        role: Role.ENSEIGNANT,
        actif: true,
      },
    });
    if (valides !== enseignants.length) {
      throw new BadRequestException(
        'Chaque professeur doit être un enseignant actif de l’école.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.enseignement.deleteMany({
        where: { classeId, matiereId: { notIn: matiereIds } },
      }),
      ...dto.enseignements.map((e) =>
        this.prisma.enseignement.upsert({
          where: { classeId_matiereId: { classeId, matiereId: e.matiereId } },
          update: { enseignantId: e.enseignantId ?? null },
          create: {
            classeId,
            matiereId: e.matiereId,
            enseignantId: e.enseignantId ?? null,
            creePar: u.id,
          },
        }),
      ),
    ]);
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Classe',
      classeId,
      {
        enseignements: dto.enseignements.length,
      },
    );
    return this.enseignements(u, classeId);
  }

  /** Personnel actif de l'école (choix d'un professeur, d'un enseignant principal…). */
  async personnel(u: UtilisateurConnecte, role?: Role) {
    return this.prisma.utilisateur.findMany({
      where: {
        ecoleId: u.ecoleId,
        actif: true,
        role: role ?? { not: Role.PARENT },
      },
      select: { id: true, prenoms: true, nom: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
    });
  }

  private async trouverMatiere(ecoleId: string, id: string) {
    const matiere = await this.prisma.matiere.findFirst({
      where: { id, ecoleId },
    });
    if (!matiere) throw new BadRequestException('Matière inconnue.');
    return matiere;
  }

  private async trouverClasse(ecoleId: string, id: string) {
    const classe = await this.prisma.classe.findFirst({
      where: { id, ecoleId },
    });
    if (!classe) throw new NotFoundException('Classe introuvable.');
    return classe;
  }
}
