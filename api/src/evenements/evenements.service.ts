import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  instantDakar,
  erreurProgrammation,
} from '../annonces/annonces.regles.js';
import { AnnoncesService } from '../annonces/annonces.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ClassesService } from '../classes/classes.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  CibleAnnonce,
  Role,
  StatutAnnonce,
  StatutEleve,
  TypeAnnonce,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockageService } from '../stockage/stockage.service.js';
import type {
  CreerEvenementDto,
  FiltreEvenementsDto,
  RepondreEvenementDto,
} from './evenements.dto.js';
import {
  EXTENSIONS,
  reponseRetenue,
  typeDocument,
} from './evenements.regles.js';

const selectionEvenement = {
  id: true,
  titre: true,
  message: true,
  dateDebut: true,
  dateFin: true,
  lieu: true,
  modalites: true,
  pieceJointeUrl: true,
  cible: true,
  demandeReponse: true,
  question: true,
  statut: true,
  programmeeLe: true,
  envoyeeLe: true,
  rappelEnvoyeLe: true,
  creeLe: true,
  auteur: { select: { prenoms: true, nom: true } },
  classes: { select: { classe: { select: { id: true, nom: true } } } },
} satisfies Prisma.AnnonceSelect;

type EvenementBrut = Prisma.AnnonceGetPayload<{
  select: typeof selectionEvenement;
}>;

/** Le chemin de stockage de la pièce jointe reste interne : seul son type est exposé. */
const formater = ({
  classes,
  pieceJointeUrl,
  message,
  ...e
}: EvenementBrut) => ({
  ...e,
  description: message,
  pieceJointe: pieceJointeUrl
    ? pieceJointeUrl.endsWith('.pdf')
      ? 'PDF'
      : 'IMAGE'
    : null,
  classes: classes.map((c) => c.classe),
});

const selectionEleve = {
  id: true,
  prenoms: true,
  nom: true,
  classeId: true,
  classe: { select: { nom: true } },
} satisfies Prisma.EleveSelect;

/**
 * Événements de l'école (EF-70 à EF-72) : annonces de type EVENEMENT, avec
 * pièce jointe, rappel la veille et réponses oui / non des parents.
 */
@Injectable()
export class EvenementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly annonces: AnnoncesService,
    private readonly classes: ClassesService,
    private readonly stockage: StockageService,
    private readonly audit: AuditService,
  ) {}

  /** Crée l'événement en brouillon : rien n'est envoyé avant la publication. */
  async creer(u: UtilisateurConnecte, dto: CreerEvenementDto) {
    const parClasses = dto.cible === CibleAnnonce.CLASSES;
    const classeIds = parClasses ? [...new Set(dto.classeIds ?? [])] : [];
    for (const id of classeIds)
      await this.classes.verifierClasse(u.ecoleId, id);

    const dateDebut = instantDakar(dto.date, dto.heure);
    const dateFin = dto.dateFin ? instantDakar(dto.dateFin, '23:59') : null;
    if (
      Number.isNaN(dateDebut.getTime()) ||
      (dateFin && Number.isNaN(dateFin.getTime()))
    )
      throw new BadRequestException('Date invalide.');
    if (dateDebut <= new Date())
      throw new BadRequestException("L'événement doit être à venir.");
    if (dateFin && dateFin < dateDebut)
      throw new BadRequestException(
        'La date de fin doit suivre la date de début.',
      );

    const evenement = await this.prisma.annonce.create({
      data: {
        ecoleId: u.ecoleId,
        type: TypeAnnonce.EVENEMENT,
        titre: dto.titre,
        message: dto.description,
        dateDebut,
        dateFin,
        lieu: dto.lieu,
        modalites: dto.modalites,
        cible: dto.cible,
        question: dto.question,
        demandeReponse: Boolean(dto.question),
        statut: StatutAnnonce.BROUILLON,
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
      evenement.id,
      { type: TypeAnnonce.EVENEMENT },
    );
    return this.detail(u, evenement.id);
  }

  /** Joint un PDF ou une image, tant que l'événement n'est pas envoyé. */
  async joindre(
    u: UtilisateurConnecte,
    id: string,
    fichier?: Express.Multer.File,
  ) {
    const evenement = await this.trouver(u, id);
    this.exigerNonEnvoye(evenement.statut);
    if (!fichier)
      throw new BadRequestException(
        'Joignez un fichier dans le champ « fichier ».',
      );
    const type = typeDocument(fichier.buffer);
    if (!type)
      throw new BadRequestException(
        'La pièce jointe doit être un PDF ou une image (JPEG, PNG, WebP).',
      );
    const cle = `evenements/${id}.${EXTENSIONS[type]}`;
    await this.stockage.enregistrer(cle, fichier.buffer);
    if (evenement.pieceJointeUrl && evenement.pieceJointeUrl !== cle)
      await this.stockage.supprimer(evenement.pieceJointeUrl);
    await this.prisma.annonce.update({
      where: { id },
      data: { pieceJointeUrl: cle },
    });
    return this.detail(u, id);
  }

  async retirerPieceJointe(u: UtilisateurConnecte, id: string) {
    const evenement = await this.trouver(u, id);
    this.exigerNonEnvoye(evenement.statut);
    if (evenement.pieceJointeUrl)
      await this.stockage.supprimer(evenement.pieceJointeUrl);
    await this.prisma.annonce.update({
      where: { id },
      data: { pieceJointeUrl: null },
    });
    return this.detail(u, id);
  }

  async lirePieceJointe(u: UtilisateurConnecte, id: string) {
    const evenement = await this.trouverVisible(u, id);
    const contenu = evenement.pieceJointeUrl
      ? await this.stockage.lire(evenement.pieceJointeUrl)
      : null;
    const type = contenu && typeDocument(contenu);
    if (!contenu || !type)
      throw new NotFoundException("Cet événement n'a pas de pièce jointe.");
    return {
      contenu,
      type,
      nom: `${evenement.titre}.${EXTENSIONS[type]}`,
    };
  }

  /** Prévient les familles maintenant, ou à la date choisie. */
  async publier(u: UtilisateurConnecte, id: string, programmeeLe?: string) {
    const evenement = await this.trouver(u, id);
    if (evenement.statut !== StatutAnnonce.BROUILLON)
      throw new BadRequestException('Cet événement a déjà été publié.');
    const quand = programmeeLe ? new Date(programmeeLe) : null;
    if (quand) {
      const erreur = erreurProgrammation(quand);
      if (erreur) throw new BadRequestException(erreur);
      if (quand >= evenement.dateDebut)
        throw new BadRequestException(
          "L'envoi doit avoir lieu avant l'événement.",
        );
      await this.prisma.annonce.update({
        where: { id },
        data: { statut: StatutAnnonce.PROGRAMMEE, programmeeLe: quand },
      });
    } else if (evenement.dateDebut <= new Date()) {
      throw new BadRequestException("L'événement est déjà passé.");
    }
    await this.annonces.publier(id, quand);
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Annonce', id, {
      publie: true,
      programmee: Boolean(quand),
    });
    return this.detail(u, id);
  }

  async annuler(u: UtilisateurConnecte, id: string) {
    await this.annonces.annulerEvenement(u, id);
    return this.detail(u, id);
  }

  /** Brouillon jamais envoyé : suppression définitive. */
  async supprimer(u: UtilisateurConnecte, id: string) {
    const evenement = await this.trouver(u, id);
    if (evenement.statut !== StatutAnnonce.BROUILLON)
      throw new BadRequestException(
        'Un événement publié ne se supprime pas : annulez-le.',
      );
    if (evenement.pieceJointeUrl)
      await this.stockage.supprimer(evenement.pieceJointeUrl);
    await this.prisma.annonce.delete({ where: { id } });
    await this.audit.journaliser(u, ActionAudit.SUPPRESSION, 'Annonce', id);
  }

  /** Calendrier : événements qui touchent la période, du plus proche au plus lointain. */
  async lister(u: UtilisateurConnecte, filtre: FiltreEvenementsDto) {
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const du = filtre.du ?? `${aujourdHui.slice(0, 7)}-01`;
    const debut = instantDakar(du);
    const fin = filtre.au
      ? instantDakar(filtre.au)
      : new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0));
    fin.setUTCHours(23, 59, 59, 999);
    if (
      Number.isNaN(debut.getTime()) ||
      Number.isNaN(fin.getTime()) ||
      fin < debut
    )
      throw new BadRequestException('Période invalide.');

    const periode: Prisma.AnnonceWhereInput = {
      OR: [
        { dateDebut: { gte: debut, lte: fin } },
        { dateDebut: { lt: debut }, dateFin: { gte: debut } },
      ],
    };

    if (u.role === Role.PARENT) {
      const enfants = await this.enfants(u);
      const evenements = await this.prisma.annonce.findMany({
        where: { AND: [this.visiblesParent(u, enfants), periode] },
        select: selectionEvenement,
        orderBy: { dateDebut: 'asc' },
        take: 500,
      });
      const reponses = await this.prisma.reponseAnnonce.findMany({
        where: {
          annonceId: { in: evenements.map((e) => e.id) },
          tuteurId: u.tuteurId ?? '',
        },
        select: { annonceId: true, eleveId: true, reponse: true },
      });
      return evenements.map((e) => ({
        ...formater(e),
        enfants: this.enfantsConcernes(e, enfants).map((enfant) => ({
          ...enfant,
          reponse:
            reponses.find(
              (r) => r.annonceId === e.id && r.eleveId === enfant.id,
            )?.reponse ?? null,
        })),
      }));
    }

    const evenements = await this.prisma.annonce.findMany({
      where: { ecoleId: u.ecoleId, type: TypeAnnonce.EVENEMENT, ...periode },
      select: {
        ...selectionEvenement,
        reponses: { select: { eleveId: true, reponse: true, modifieLe: true } },
      },
      orderBy: { dateDebut: 'asc' },
      take: 500,
    });
    return evenements.map(({ reponses, ...e }) => ({
      ...formater(e),
      reponses: this.compter(reponses),
    }));
  }

  /** Personnel : événement, suivi des envois et réponses élève par élève. Parent : ses enfants concernés. */
  async detail(u: UtilisateurConnecte, id: string) {
    if (u.role === Role.PARENT) {
      const enfants = await this.enfants(u);
      const evenement = await this.prisma.annonce.findFirst({
        where: { id, ...this.visiblesParent(u, enfants) },
        select: selectionEvenement,
      });
      if (!evenement) throw new NotFoundException('Événement introuvable.');
      const reponses = await this.prisma.reponseAnnonce.findMany({
        where: { annonceId: id, tuteurId: u.tuteurId ?? '' },
        select: { eleveId: true, reponse: true, commentaire: true },
      });
      return {
        ...formater(evenement),
        enfants: this.enfantsConcernes(evenement, enfants).map((enfant) => {
          const r = reponses.find((x) => x.eleveId === enfant.id);
          return {
            ...enfant,
            reponse: r?.reponse ?? null,
            commentaire: r?.commentaire ?? null,
          };
        }),
      };
    }

    const evenement = await this.prisma.annonce.findFirst({
      where: { id, ecoleId: u.ecoleId, type: TypeAnnonce.EVENEMENT },
      select: selectionEvenement,
    });
    if (!evenement) throw new NotFoundException('Événement introuvable.');
    const [suivi, eleves] = await Promise.all([
      this.annonces.suivi(id),
      evenement.demandeReponse
        ? this.prisma.eleve.findMany({
            where: {
              ecoleId: u.ecoleId,
              statut: StatutEleve.ACTIF,
              ...(evenement.cible === CibleAnnonce.CLASSES
                ? {
                    classeId: {
                      in: evenement.classes.map((c) => c.classe.id),
                    },
                  }
                : {}),
            },
            select: {
              ...selectionEleve,
              reponsesAnnonce: {
                where: { annonceId: id },
                select: {
                  reponse: true,
                  commentaire: true,
                  modifieLe: true,
                  tuteur: { select: { prenoms: true, nom: true } },
                },
              },
            },
            orderBy: [
              { classe: { nom: 'asc' } },
              { nom: 'asc' },
              { prenoms: 'asc' },
            ],
            take: 3000,
          })
        : Promise.resolve([]),
    ]);

    const lignes = eleves.map(({ reponsesAnnonce, classeId: _c, ...eleve }) => {
      const retenue = reponseRetenue(reponsesAnnonce);
      return {
        ...eleve,
        reponse: retenue?.reponse ?? null,
        commentaire: retenue?.commentaire ?? null,
        repondant: retenue?.tuteur ?? null,
        reponduLe: retenue?.modifieLe ?? null,
      };
    });
    return {
      ...formater(evenement),
      suivi,
      reponses: evenement.demandeReponse
        ? {
            oui: lignes.filter((l) => l.reponse === true).length,
            non: lignes.filter((l) => l.reponse === false).length,
            sansReponse: lignes.filter((l) => l.reponse === null).length,
            eleves: lignes,
          }
        : null,
    };
  }

  /** Le parent répond pour chacun de ses enfants ; il peut changer d'avis jusqu'à l'événement. */
  async repondre(
    u: UtilisateurConnecte,
    id: string,
    dto: RepondreEvenementDto,
  ) {
    const enfants = await this.enfants(u);
    const evenement = await this.prisma.annonce.findFirst({
      where: { id, ...this.visiblesParent(u, enfants) },
      select: selectionEvenement,
    });
    if (!evenement) throw new NotFoundException('Événement introuvable.');
    if (!evenement.demandeReponse)
      throw new BadRequestException("Cet événement n'attend pas de réponse.");
    if (evenement.statut !== StatutAnnonce.ENVOYEE)
      throw new BadRequestException('Cet événement est annulé.');
    if (evenement.dateDebut <= new Date())
      throw new BadRequestException("L'événement a déjà commencé.");
    if (
      !this.enfantsConcernes(evenement, enfants).some(
        (e) => e.id === dto.eleveId,
      )
    )
      throw new ForbiddenException("Cet enfant n'est pas concerné.");

    const tuteurId = u.tuteurId ?? '';
    await this.prisma.reponseAnnonce.upsert({
      where: {
        annonceId_tuteurId_eleveId: {
          annonceId: id,
          tuteurId,
          eleveId: dto.eleveId,
        },
      },
      create: {
        annonceId: id,
        tuteurId,
        eleveId: dto.eleveId,
        reponse: dto.reponse,
        commentaire: dto.commentaire,
        creePar: u.id,
      },
      update: { reponse: dto.reponse, commentaire: dto.commentaire ?? null },
    });
    return this.detail(u, id);
  }

  private async trouver(u: UtilisateurConnecte, id: string) {
    const evenement = await this.prisma.annonce.findFirst({
      where: { id, ecoleId: u.ecoleId, type: TypeAnnonce.EVENEMENT },
      select: {
        statut: true,
        pieceJointeUrl: true,
        dateDebut: true,
        titre: true,
      },
    });
    if (!evenement) throw new NotFoundException('Événement introuvable.');
    return evenement;
  }

  private async trouverVisible(u: UtilisateurConnecte, id: string) {
    if (u.role !== Role.PARENT) return this.trouver(u, id);
    const evenement = await this.prisma.annonce.findFirst({
      where: { id, ...this.visiblesParent(u, await this.enfants(u)) },
      select: { pieceJointeUrl: true, titre: true },
    });
    if (!evenement) throw new NotFoundException('Événement introuvable.');
    return evenement;
  }

  private exigerNonEnvoye(statut: StatutAnnonce) {
    if (
      statut !== StatutAnnonce.BROUILLON &&
      statut !== StatutAnnonce.PROGRAMMEE
    )
      throw new BadRequestException(
        'Les familles ont déjà été prévenues : la pièce jointe ne peut plus changer.',
      );
  }

  private enfants(u: UtilisateurConnecte) {
    return this.prisma.eleve.findMany({
      where: {
        ecoleId: u.ecoleId,
        statut: StatutEleve.ACTIF,
        tuteurs: { some: { tuteurId: u.tuteurId ?? '' } },
      },
      select: selectionEleve,
      orderBy: { prenoms: 'asc' },
    });
  }

  /** Événements envoyés (ou annulés après envoi) qui touchent l'école entière ou la classe d'un enfant. */
  private visiblesParent(
    u: UtilisateurConnecte,
    enfants: { classeId: string | null }[],
  ): Prisma.AnnonceWhereInput {
    const classeIds = enfants.flatMap((e) => (e.classeId ? [e.classeId] : []));
    return {
      ecoleId: u.ecoleId,
      type: TypeAnnonce.EVENEMENT,
      envoyeeLe: { not: null },
      statut: { in: [StatutAnnonce.ENVOYEE, StatutAnnonce.ANNULEE] },
      OR: [
        ...(enfants.length ? [{ cible: CibleAnnonce.ECOLE }] : []),
        { classes: { some: { classeId: { in: classeIds } } } },
      ],
    };
  }

  private enfantsConcernes(
    evenement: EvenementBrut,
    enfants: Prisma.EleveGetPayload<{ select: typeof selectionEleve }>[],
  ) {
    const classes = new Set(evenement.classes.map((c) => c.classe.id));
    return enfants
      .filter(
        (e) =>
          evenement.cible === CibleAnnonce.ECOLE ||
          (e.classeId && classes.has(e.classeId)),
      )
      .map(({ classeId: _c, ...e }) => e);
  }

  private compter(
    reponses: { eleveId: string; reponse: boolean; modifieLe: Date }[],
  ) {
    const parEleve = new Map<string, typeof reponses>();
    for (const r of reponses)
      parEleve.set(r.eleveId, [...(parEleve.get(r.eleveId) ?? []), r]);
    let oui = 0;
    let non = 0;
    for (const liste of parEleve.values()) {
      if (reponseRetenue(liste)?.reponse) oui++;
      else non++;
    }
    return { oui, non };
  }
}
