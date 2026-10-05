import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { estDoublon } from '../common/erreurs-prisma.js';
import { ActionAudit, Role, StatutEleve } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreerClasseDto,
  FiltreClassesDto,
  ModifierClasseDto,
} from './classes.dto.js';

const selectionClasse = {
  id: true,
  nom: true,
  niveau: true,
  anneeScolaire: { select: { id: true, libelle: true, active: true } },
  enseignantPrincipal: { select: { id: true, prenoms: true, nom: true } },
  _count: { select: { eleves: { where: { statut: StatutEleve.ACTIF } } } },
} as const;

function formaterClasse<T extends { _count: { eleves: number } }>({
  _count,
  ...classe
}: T) {
  return { ...classe, effectif: _count.eleves };
}

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async anneeActive(ecoleId: string) {
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { ecoleId, active: true },
    });
    if (!annee) {
      throw new BadRequestException(
        "Aucune année scolaire active : créez-en une avant d'ajouter des classes.",
      );
    }
    return annee;
  }

  async lister(u: UtilisateurConnecte, filtre: FiltreClassesDto) {
    const anneeScolaireId =
      filtre.anneeScolaireId ?? (await this.anneeActive(u.ecoleId)).id;
    const classes = await this.prisma.classe.findMany({
      where: { ecoleId: u.ecoleId, anneeScolaireId },
      select: selectionClasse,
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
    return classes.map(formaterClasse);
  }

  async detail(u: UtilisateurConnecte, id: string) {
    const classe = await this.prisma.classe.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: {
        ...selectionClasse,
        eleves: {
          where: { statut: StatutEleve.ACTIF },
          select: {
            id: true,
            matricule: true,
            prenoms: true,
            nom: true,
            genre: true,
          },
          orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
        },
      },
    });
    if (!classe) throw new NotFoundException('Classe introuvable.');
    const { eleves, ...reste } = classe;
    return { ...formaterClasse(reste), eleves };
  }

  async creer(u: UtilisateurConnecte, dto: CreerClasseDto) {
    const anneeScolaireId = dto.anneeScolaireId
      ? (await this.verifierAnnee(u.ecoleId, dto.anneeScolaireId)).id
      : (await this.anneeActive(u.ecoleId)).id;
    await this.verifierEnseignant(u.ecoleId, dto.enseignantPrincipalId);

    try {
      const classe = await this.prisma.classe.create({
        data: {
          ecoleId: u.ecoleId,
          anneeScolaireId,
          nom: dto.nom,
          niveau: dto.niveau,
          enseignantPrincipalId: dto.enseignantPrincipalId,
          creePar: u.id,
        },
        select: selectionClasse,
      });
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Classe',
        classe.id,
        { nom: classe.nom },
      );
      return formaterClasse(classe);
    } catch (e) {
      if (estDoublon(e)) {
        throw new ConflictException(
          `La classe « ${dto.nom} » existe déjà pour cette année scolaire.`,
        );
      }
      throw e;
    }
  }

  async modifier(u: UtilisateurConnecte, id: string, dto: ModifierClasseDto) {
    await this.detail(u, id);
    if (dto.anneeScolaireId) {
      await this.verifierAnnee(u.ecoleId, dto.anneeScolaireId);
    }
    await this.verifierEnseignant(u.ecoleId, dto.enseignantPrincipalId);

    try {
      const classe = await this.prisma.classe.update({
        where: { id },
        data: dto,
        select: selectionClasse,
      });
      await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Classe', id, {
        champs: Object.keys(dto),
      });
      return formaterClasse(classe);
    } catch (e) {
      if (estDoublon(e)) {
        throw new ConflictException(
          'Une classe porte déjà ce nom pour cette année scolaire.',
        );
      }
      throw e;
    }
  }

  /** Vérifie qu'une classe appartient à l'école. */
  async verifierClasse(ecoleId: string, classeId: string): Promise<void> {
    const classe = await this.prisma.classe.findFirst({
      where: { id: classeId, ecoleId },
      select: { id: true },
    });
    if (!classe) throw new BadRequestException('Classe inconnue.');
  }

  private async verifierAnnee(ecoleId: string, id: string) {
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { id, ecoleId },
    });
    if (!annee) throw new BadRequestException('Année scolaire inconnue.');
    return annee;
  }

  private async verifierEnseignant(ecoleId: string, id?: string) {
    if (!id) return;
    const enseignant = await this.prisma.utilisateur.findFirst({
      where: { id, ecoleId, role: Role.ENSEIGNANT, actif: true },
      select: { id: true },
    });
    if (!enseignant) {
      throw new BadRequestException(
        "L'enseignant principal doit être un enseignant actif de l'école.",
      );
    }
  }
}
