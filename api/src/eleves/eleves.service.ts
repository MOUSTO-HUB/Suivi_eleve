import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ClassesService } from '../classes/classes.service.js';
import { calculerAge, depuisJour, versJour } from '../common/dates.js';
import { estDoublon } from '../common/erreurs-prisma.js';
import { page, sauter } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import { ActionAudit, Role, StatutEleve } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { selectionTuteur } from '../tuteurs/tuteurs.service.js';
import type {
  ArchiverEleveDto,
  ChangerClasseDto,
  CreerEleveDto,
  FiltreElevesDto,
  ModifierEleveDto,
  TuteurEleveDto,
} from './eleves.dto.js';
import {
  normaliserTuteurs,
  prochainMatricule,
  verifierDateNaissance,
} from './eleves.regles.js';

const ESSAIS_MATRICULE = 5;

export const selectionEleve = {
  id: true,
  matricule: true,
  prenoms: true,
  nom: true,
  genre: true,
  dateNaissance: true,
  telephone: true,
  photoUrl: true,
  statut: true,
  dateInscription: true,
  classe: { select: { id: true, nom: true, niveau: true } },
  tuteurs: {
    select: {
      lien: true,
      principal: true,
      tuteur: { select: selectionTuteur },
    },
    orderBy: { principal: 'desc' },
  },
} satisfies Prisma.EleveSelect;

type EleveBrut = Prisma.EleveGetPayload<{ select: typeof selectionEleve }>;

export function formaterEleve(eleve: EleveBrut) {
  return {
    ...eleve,
    dateNaissance: versJour(eleve.dateNaissance),
    dateInscription: versJour(eleve.dateInscription),
    age: calculerAge(eleve.dateNaissance),
    tuteurs: eleve.tuteurs.map(({ tuteur, lien, principal }) => ({
      ...tuteur,
      lien,
      principal,
    })),
  };
}

export type EleveFormate = ReturnType<typeof formaterEleve>;

const aujourdHui = () => depuisJour(versJour(new Date()));

@Injectable()
export class ElevesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
  ) {}

  /** Filtre commun à la liste et à l'export. Un parent ne voit que ses enfants. */
  construireFiltre(
    u: UtilisateurConnecte,
    filtre: Omit<FiltreElevesDto, 'page' | 'parPage'>,
  ): Prisma.EleveWhereInput {
    const conditions: Prisma.EleveWhereInput[] = [];
    if (u.role === Role.PARENT) {
      conditions.push({ tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } });
    }
    if (filtre.tuteurId) {
      conditions.push({ tuteurs: { some: { tuteurId: filtre.tuteurId } } });
    }
    for (const mot of filtre.q?.split(/\s+/).filter(Boolean) ?? []) {
      conditions.push({
        OR: [
          { matricule: { contains: mot, mode: 'insensitive' } },
          { nom: { contains: mot, mode: 'insensitive' } },
          { prenoms: { contains: mot, mode: 'insensitive' } },
          {
            tuteurs: {
              some: {
                tuteur: {
                  OR: [
                    { nom: { contains: mot, mode: 'insensitive' } },
                    { prenoms: { contains: mot, mode: 'insensitive' } },
                    { contact1: { contains: mot } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
    return {
      ecoleId: u.ecoleId,
      statut: filtre.statut ?? StatutEleve.ACTIF,
      classeId: filtre.classeId,
      AND: conditions,
    };
  }

  async lister(u: UtilisateurConnecte, filtre: FiltreElevesDto) {
    const where = this.construireFiltre(u, filtre);
    const [eleves, total] = await this.prisma.$transaction([
      this.prisma.eleve.findMany({
        where,
        select: selectionEleve,
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
        ...sauter(filtre),
      }),
      this.prisma.eleve.count({ where }),
    ]);
    return page(eleves.map(formaterEleve), total, filtre);
  }

  async detail(u: UtilisateurConnecte, id: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: {
        ...selectionEleve,
        historiqueClasse: {
          select: {
            dateDebut: true,
            dateFin: true,
            classe: { select: { id: true, nom: true } },
          },
          orderBy: { dateDebut: 'desc' },
        },
      },
    });
    if (!eleve) throw new NotFoundException('Élève introuvable.');
    const { historiqueClasse, ...reste } = eleve;
    return {
      ...formaterEleve(reste),
      historiqueClasse: historiqueClasse.map((h) => ({
        classe: h.classe,
        dateDebut: versJour(h.dateDebut),
        dateFin: h.dateFin ? versJour(h.dateFin) : null,
      })),
    };
  }

  async creer(u: UtilisateurConnecte, dto: CreerEleveDto) {
    const { id, matricule } = await this.creerInterne(u, dto);
    await this.audit.journaliser(u, ActionAudit.CREATION, 'Eleve', id, {
      matricule,
    });
    return this.detail(u, id);
  }

  /** Création sans audit ni relecture : utilisée aussi par l'import. */
  async creerInterne(
    u: UtilisateurConnecte,
    dto: CreerEleveDto,
  ): Promise<{ id: string; matricule: string }> {
    verifierDateNaissance(dto.dateNaissance);
    if (dto.classeId)
      await this.classes.verifierClasse(u.ecoleId, dto.classeId);
    const tuteurs = normaliserTuteurs(dto.tuteurs);
    const dateInscription = dto.dateInscription
      ? depuisJour(dto.dateInscription)
      : aujourdHui();
    if (Number.isNaN(dateInscription.getTime())) {
      throw new BadRequestException("Date d'inscription invalide.");
    }

    // Deux inscriptions simultanées peuvent viser le même matricule : on réessaie.
    for (let essai = 1; ; essai++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const liens = [];
          for (const t of tuteurs) {
            liens.push({
              tuteurId: await this.resoudreTuteur(tx, u, t),
              lien: t.lien,
              principal: t.principal,
              creePar: u.id,
            });
          }
          const matricule = await prochainMatricule(
            tx,
            dateInscription.getUTCFullYear(),
          );
          return tx.eleve.create({
            data: {
              ecoleId: u.ecoleId,
              matricule,
              prenoms: dto.prenoms,
              nom: dto.nom,
              genre: dto.genre,
              dateNaissance: depuisJour(dto.dateNaissance),
              telephone: dto.telephone,
              classeId: dto.classeId,
              dateInscription,
              creePar: u.id,
              tuteurs: { create: liens },
              historiqueClasse: dto.classeId
                ? {
                    create: {
                      classeId: dto.classeId,
                      dateDebut: dateInscription,
                      creePar: u.id,
                    },
                  }
                : undefined,
            },
            select: { id: true, matricule: true },
          });
        });
      } catch (e) {
        if (estDoublon(e) && essai < ESSAIS_MATRICULE) continue;
        throw e;
      }
    }
  }

  async modifier(u: UtilisateurConnecte, id: string, dto: ModifierEleveDto) {
    await this.trouver(u, id);
    if (dto.dateNaissance) verifierDateNaissance(dto.dateNaissance);
    await this.prisma.eleve.update({
      where: { id },
      data: {
        prenoms: dto.prenoms,
        nom: dto.nom,
        genre: dto.genre,
        telephone: dto.telephone,
        dateNaissance: dto.dateNaissance
          ? depuisJour(dto.dateNaissance)
          : undefined,
      },
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Eleve', id, {
      champs: Object.keys(dto),
    });
    return this.detail(u, id);
  }

  async changerClasse(
    u: UtilisateurConnecte,
    id: string,
    dto: ChangerClasseDto,
  ) {
    const eleve = await this.trouver(u, id);
    if (eleve.statut === StatutEleve.ARCHIVE) {
      throw new BadRequestException(
        "Restaurez l'élève avant de changer sa classe.",
      );
    }
    if (eleve.classeId === dto.classeId) {
      throw new BadRequestException("L'élève est déjà dans cette classe.");
    }
    await this.classes.verifierClasse(u.ecoleId, dto.classeId);
    const date = dto.date ? depuisJour(dto.date) : aujourdHui();

    await this.prisma.$transaction([
      this.prisma.historiqueClasse.updateMany({
        where: { eleveId: id, dateFin: null },
        data: { dateFin: date },
      }),
      this.prisma.historiqueClasse.create({
        data: {
          eleveId: id,
          classeId: dto.classeId,
          dateDebut: date,
          creePar: u.id,
        },
      }),
      this.prisma.eleve.update({
        where: { id },
        data: { classeId: dto.classeId },
      }),
    ]);
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Eleve', id, {
      changementClasse: { de: eleve.classeId, vers: dto.classeId },
    });
    return this.detail(u, id);
  }

  async archiver(u: UtilisateurConnecte, id: string, dto: ArchiverEleveDto) {
    const eleve = await this.trouver(u, id);
    if (eleve.statut === StatutEleve.ARCHIVE) {
      throw new BadRequestException('Cet élève est déjà archivé.');
    }
    await this.prisma.$transaction([
      this.prisma.historiqueClasse.updateMany({
        where: { eleveId: id, dateFin: null },
        data: { dateFin: aujourdHui() },
      }),
      this.prisma.eleve.update({
        where: { id },
        data: { statut: StatutEleve.ARCHIVE },
      }),
    ]);
    await this.audit.journaliser(u, ActionAudit.ARCHIVAGE, 'Eleve', id, {
      motif: dto.motif ?? null,
    });
    return this.detail(u, id);
  }

  async restaurer(u: UtilisateurConnecte, id: string) {
    const eleve = await this.trouver(u, id);
    if (eleve.statut !== StatutEleve.ARCHIVE) {
      throw new BadRequestException("Cet élève n'est pas archivé.");
    }
    await this.prisma.$transaction([
      this.prisma.eleve.update({
        where: { id },
        data: { statut: StatutEleve.ACTIF },
      }),
      ...(eleve.classeId
        ? [
            this.prisma.historiqueClasse.create({
              data: {
                eleveId: id,
                classeId: eleve.classeId,
                dateDebut: aujourdHui(),
                creePar: u.id,
              },
            }),
          ]
        : []),
    ]);
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Eleve', id, {
      restauration: true,
    });
    return this.detail(u, id);
  }

  async ajouterTuteur(u: UtilisateurConnecte, id: string, dto: TuteurEleveDto) {
    await this.trouver(u, id);
    await this.prisma.$transaction(async (tx) => {
      const tuteurId = await this.resoudreTuteur(tx, u, dto);
      const existe = await tx.eleveTuteur.findUnique({
        where: { eleveId_tuteurId: { eleveId: id, tuteurId } },
      });
      if (existe) {
        throw new ConflictException('Ce tuteur est déjà rattaché à l’élève.');
      }
      if (dto.principal) {
        await tx.eleveTuteur.updateMany({
          where: { eleveId: id },
          data: { principal: false },
        });
      }
      await tx.eleveTuteur.create({
        data: {
          eleveId: id,
          tuteurId,
          lien: dto.lien,
          principal: Boolean(dto.principal),
          creePar: u.id,
        },
      });
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Eleve', id, {
      tuteurAjoute: true,
    });
    return this.detail(u, id);
  }

  async retirerTuteur(u: UtilisateurConnecte, id: string, tuteurId: string) {
    await this.trouver(u, id);
    const liens = await this.prisma.eleveTuteur.findMany({
      where: { eleveId: id },
      orderBy: { creeLe: 'asc' },
    });
    const retire = liens.find((l) => l.tuteurId === tuteurId);
    if (!retire) {
      throw new NotFoundException("Ce tuteur n'est pas rattaché à l'élève.");
    }
    if (liens.length === 1) {
      throw new BadRequestException('Un élève doit garder au moins un tuteur.');
    }
    const suivant = liens.find((l) => l.tuteurId !== tuteurId)!;
    await this.prisma.$transaction([
      this.prisma.eleveTuteur.delete({
        where: { eleveId_tuteurId: { eleveId: id, tuteurId } },
      }),
      ...(retire.principal
        ? [
            this.prisma.eleveTuteur.update({
              where: {
                eleveId_tuteurId: { eleveId: id, tuteurId: suivant.tuteurId },
              },
              data: { principal: true },
            }),
          ]
        : []),
    ]);
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Eleve', id, {
      tuteurRetire: tuteurId,
    });
    return this.detail(u, id);
  }

  private async trouver(u: UtilisateurConnecte, id: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id, ecoleId: u.ecoleId },
      select: { id: true, statut: true, classeId: true },
    });
    if (!eleve) throw new NotFoundException('Élève introuvable.');
    return eleve;
  }

  /**
   * Tuteur existant (par id), ou nouveau tuteur. Un Contact_tuteur_1 déjà connu
   * désigne le même tuteur (frères et sœurs) : il est réutilisé, pas dupliqué.
   */
  private async resoudreTuteur(
    tx: Prisma.TransactionClient,
    u: UtilisateurConnecte,
    t: TuteurEleveDto,
  ): Promise<string> {
    if (t.tuteurId) {
      const tuteur = await tx.tuteur.findFirst({
        where: { id: t.tuteurId, ecoleId: u.ecoleId },
        select: { id: true },
      });
      if (!tuteur) throw new BadRequestException('Tuteur inconnu.');
      return tuteur.id;
    }
    const contact1 = t.contact1!;
    const existant = await tx.tuteur.findUnique({
      where: { ecoleId_contact1: { ecoleId: u.ecoleId, contact1 } },
      select: { id: true },
    });
    if (existant) return existant.id;

    const cree = await tx.tuteur.create({
      data: {
        ecoleId: u.ecoleId,
        prenoms: t.prenoms!,
        nom: t.nom!,
        contact1,
        contact2: t.contact2,
        email: t.email,
        creePar: u.id,
      },
      select: { id: true },
    });
    return cree.id;
  }
}
