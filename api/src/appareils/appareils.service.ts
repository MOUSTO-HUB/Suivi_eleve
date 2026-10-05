import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { page, sauter } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  CategorieComportement,
  Role,
  StatutEleve,
  TypeComportement,
  TypeIncidentAppareil,
  TypeNotification,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockageService } from '../stockage/stockage.service.js';
import type {
  CreerAppareilDto,
  FiltreAppareilsDto,
  ModifierAppareilDto,
  SignalementDto,
} from './appareils.dto.js';
import {
  codeCourt,
  debutDuMois,
  erreurIncident,
  REGLES_INCIDENT,
  seuilAtteint,
} from './appareils.regles.js';

const selectionAppareil = {
  id: true,
  type: true,
  marque: true,
  modele: true,
  couleur: true,
  numeroSerie: true,
  imei: true,
  signesDistinctifs: true,
  photoUrl: true,
  qrCode: true,
  statut: true,
  creeLe: true,
  eleve: {
    select: {
      id: true,
      ecoleId: true,
      matricule: true,
      prenoms: true,
      nom: true,
      statut: true,
      classe: { select: { id: true, nom: true } },
    },
  },
} satisfies Prisma.AppareilSelect;

type AppareilBrut = Prisma.AppareilGetPayload<{
  select: typeof selectionAppareil;
}>;

/** La clé de stockage de la photo n'est jamais exposée : seulement sa présence. */
function formaterAppareil({ photoUrl, eleve, ...appareil }: AppareilBrut) {
  const { ecoleId: _ecole, ...proprietaire } = eleve;
  return {
    ...appareil,
    codeCourt: codeCourt(appareil.qrCode),
    aPhoto: photoUrl !== null,
    eleve: proprietaire,
  };
}

const LIBELLE_TYPE = {
  TELEPHONE: 'téléphone',
  TABLETTE: 'tablette',
  ORDINATEUR: 'ordinateur',
  AUTRE: 'appareil',
} as const;

/** « téléphone Samsung Galaxy A15 noir » */
const designation = (
  a: Pick<AppareilBrut, 'type' | 'marque' | 'modele' | 'couleur'>,
) =>
  [LIBELLE_TYPE[a.type], a.marque, a.modele, a.couleur]
    .filter(Boolean)
    .join(' ');

const dateHeureFr = (d: Date) =>
  d.toLocaleString('fr-FR', {
    timeZone: 'Africa/Dakar',
    dateStyle: 'short',
    timeStyle: 'short',
  });

@Injectable()
export class AppareilsService {
  private readonly seuilUsage: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly stockage: StockageService,
    config: ConfigService,
  ) {
    this.seuilUsage = Number(config.get('SEUIL_USAGE_APPAREIL_MOIS', 3));
  }

  async lister(u: UtilisateurConnecte, filtre: FiltreAppareilsDto) {
    const conditions: Prisma.AppareilWhereInput[] = [];
    if (u.role === Role.PARENT) {
      conditions.push({
        eleve: { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } },
      });
    }
    if (filtre.classeId)
      conditions.push({ eleve: { classeId: filtre.classeId } });
    for (const mot of filtre.q?.split(/\s+/).filter(Boolean) ?? []) {
      const sansEspaces = mot.replace(/[\s-]/g, '');
      const contient = { contains: mot, mode: 'insensitive' } as const;
      conditions.push({
        OR: [
          { imei: { contains: sansEspaces } },
          { numeroSerie: contient },
          { qrCode: { contains: mot, mode: 'insensitive' } },
          { marque: contient },
          { modele: contient },
          { couleur: contient },
          { signesDistinctifs: contient },
          { eleve: { matricule: contient } },
          { eleve: { nom: contient } },
          { eleve: { prenoms: contient } },
        ],
      });
    }
    const where: Prisma.AppareilWhereInput = {
      ecoleId: u.ecoleId,
      statut: filtre.statut,
      eleveId: filtre.eleveId,
      AND: conditions,
    };
    const [appareils, total] = await this.prisma.$transaction([
      this.prisma.appareil.findMany({
        where,
        select: selectionAppareil,
        orderBy: [
          { eleve: { nom: 'asc' } },
          { eleve: { prenoms: 'asc' } },
          { creeLe: 'asc' },
        ],
        ...sauter(filtre),
      }),
      this.prisma.appareil.count({ where }),
    ]);
    return page(appareils.map(formaterAppareil), total, filtre);
  }

  async detail(u: UtilisateurConnecte, id: string) {
    const appareil = await this.trouver(u, id);
    const incidents = await this.prisma.incidentAppareil.findMany({
      where: { appareilId: id },
      select: {
        id: true,
        type: true,
        dateHeure: true,
        lieu: true,
        commentaire: true,
        auteur: { select: { prenoms: true, nom: true, role: true } },
      },
      orderBy: { dateHeure: 'desc' },
    });
    return { ...formaterAppareil(appareil), incidents };
  }

  /**
   * Scan d'une étiquette par le personnel (EF-11) : le propriétaire et les
   * contacts de ses tuteurs. Accepte le code complet ou le code court imprimé.
   */
  async parQr(u: UtilisateurConnecte, code: string) {
    const nettoye = code.trim().toLowerCase();
    const appareils = await this.prisma.appareil.findMany({
      where: {
        ecoleId: u.ecoleId,
        qrCode: nettoye.length === 8 ? { endsWith: nettoye } : nettoye,
      },
      select: { id: true },
      take: 2,
    });
    if (appareils.length !== 1) {
      throw new NotFoundException('Aucun appareil ne correspond à ce code.');
    }
    const [detail, tuteurs] = await Promise.all([
      this.detail(u, appareils[0].id),
      this.prisma.eleveTuteur.findMany({
        where: { eleve: { appareils: { some: { id: appareils[0].id } } } },
        select: {
          lien: true,
          principal: true,
          tuteur: {
            select: {
              prenoms: true,
              nom: true,
              contact1: true,
              contact2: true,
            },
          },
        },
        orderBy: { principal: 'desc' },
      }),
    ]);
    return {
      ...detail,
      tuteurs: tuteurs.map(({ tuteur, ...lien }) => ({ ...tuteur, ...lien })),
    };
  }

  async creer(u: UtilisateurConnecte, dto: CreerAppareilDto) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: dto.eleveId, ecoleId: u.ecoleId },
      select: { id: true, statut: true },
    });
    if (!eleve) throw new BadRequestException('Élève inconnu.');
    if (eleve.statut === StatutEleve.ARCHIVE) {
      throw new BadRequestException(
        "Impossible d'ajouter un appareil à un élève archivé.",
      );
    }
    if (dto.imei) await this.verifierImeiLibre(u.ecoleId, dto.imei);

    const appareil = await this.prisma.appareil.create({
      data: {
        ecoleId: u.ecoleId,
        eleveId: dto.eleveId,
        type: dto.type,
        marque: dto.marque,
        modele: dto.modele,
        couleur: dto.couleur,
        numeroSerie: dto.numeroSerie,
        imei: dto.imei,
        signesDistinctifs: dto.signesDistinctifs,
        creePar: u.id,
      },
      select: { id: true },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'Appareil',
      appareil.id,
    );
    return this.detail(u, appareil.id);
  }

  async modifier(u: UtilisateurConnecte, id: string, dto: ModifierAppareilDto) {
    await this.trouver(u, id);
    if (dto.imei) await this.verifierImeiLibre(u.ecoleId, dto.imei, id);
    await this.prisma.appareil.update({
      where: { id },
      data: {
        type: dto.type,
        marque: dto.marque,
        modele: dto.modele,
        couleur: dto.couleur,
        numeroSerie: dto.numeroSerie,
        imei: dto.imei,
        signesDistinctifs: dto.signesDistinctifs,
      },
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Appareil', id, {
      champs: Object.keys(dto),
    });
    return this.detail(u, id);
  }

  /** Perdu, trouvé, confisqué, restitué ou utilisé en classe (EF-13, EF-14, EF-15). */
  async signaler(u: UtilisateurConnecte, id: string, dto: SignalementDto) {
    const appareil = await this.trouver(u, id);
    if (!REGLES_INCIDENT[dto.type].roles.includes(u.role)) {
      throw new ForbiddenException('Votre rôle ne permet pas ce signalement.');
    }
    const erreur = erreurIncident(dto.type, appareil.statut, u.role);
    if (erreur) throw new BadRequestException(erreur);

    const dateHeure = dto.dateHeure ? new Date(dto.dateHeure) : new Date();
    if (dateHeure.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException(
        'La date du signalement est dans le futur.',
      );
    }
    const vers = REGLES_INCIDENT[dto.type].vers;

    const comportementCree = await this.prisma.$transaction(async (tx) => {
      await tx.incidentAppareil.create({
        data: {
          appareilId: id,
          type: dto.type,
          dateHeure,
          lieu: dto.lieu,
          commentaire: dto.commentaire,
          auteurId: u.id,
          creePar: u.id,
        },
      });
      if (vers)
        await tx.appareil.update({ where: { id }, data: { statut: vers } });
      if (dto.type !== TypeIncidentAppareil.USAGE_EN_CLASSE) return false;
      return this.appliquerSeuilUsage(tx, u, appareil.eleve.id, dateHeure);
    });

    await this.prevenirParents(u, appareil, dto, dateHeure, comportementCree);
    return { ...(await this.detail(u, id)), comportementCree };
  }

  async enregistrerPhoto(
    u: UtilisateurConnecte,
    id: string,
    fichier?: Express.Multer.File,
  ) {
    const appareil = await this.trouver(u, id);
    if (!fichier)
      throw new BadRequestException(
        'Joignez une photo dans le champ « photo ».',
      );
    const type = this.stockage.verifierImage(fichier.buffer);
    const cle = `appareils/${id}.${type.split('/')[1]}`;
    await this.stockage.enregistrer(cle, fichier.buffer);
    if (appareil.photoUrl && appareil.photoUrl !== cle) {
      await this.stockage.supprimer(appareil.photoUrl);
    }
    await this.prisma.appareil.update({
      where: { id },
      data: { photoUrl: cle },
    });
    return this.detail(u, id);
  }

  async lirePhoto(u: UtilisateurConnecte, id: string) {
    const appareil = await this.trouver(u, id);
    const contenu = appareil.photoUrl
      ? await this.stockage.lire(appareil.photoUrl)
      : null;
    if (!contenu) throw new NotFoundException("Cet appareil n'a pas de photo.");
    return { contenu, type: this.stockage.verifierImage(contenu) };
  }

  /** Appareils à étiqueter, pour un élève ou une classe. */
  async pourEtiquettes(
    u: UtilisateurConnecte,
    filtre: { eleveId?: string; classeId?: string },
  ) {
    if (!filtre.eleveId && !filtre.classeId) {
      throw new BadRequestException('Indiquez un élève ou une classe.');
    }
    const [ecole, appareils] = await Promise.all([
      this.prisma.ecole.findUniqueOrThrow({
        where: { id: u.ecoleId },
        select: { nom: true },
      }),
      this.prisma.appareil.findMany({
        where: {
          ecoleId: u.ecoleId,
          eleveId: filtre.eleveId,
          eleve: { classeId: filtre.classeId, statut: StatutEleve.ACTIF },
        },
        select: selectionAppareil,
        orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
      }),
    ]);
    if (!appareils.length)
      throw new NotFoundException('Aucun appareil à étiqueter.');
    return { ecole: ecole.nom, appareils: appareils.map(formaterAppareil) };
  }

  /**
   * Charge un appareil de l'école. Un parent n'accède qu'aux appareils de ses
   * enfants ; sinon la réponse est la même que pour un appareil inexistant.
   */
  private async trouver(
    u: UtilisateurConnecte,
    id: string,
  ): Promise<AppareilBrut> {
    const appareil = await this.prisma.appareil.findFirst({
      where: {
        id,
        ecoleId: u.ecoleId,
        ...(u.role === Role.PARENT
          ? { eleve: { tuteurs: { some: { tuteurId: u.tuteurId ?? '' } } } }
          : {}),
      },
      select: selectionAppareil,
    });
    if (!appareil) throw new NotFoundException('Appareil introuvable.');
    return appareil;
  }

  private async verifierImeiLibre(
    ecoleId: string,
    imei: string,
    saufId?: string,
  ) {
    const existant = await this.prisma.appareil.findFirst({
      where: { ecoleId, imei, NOT: saufId ? { id: saufId } : undefined },
      select: { eleve: { select: { matricule: true } } },
    });
    if (existant) {
      throw new ConflictException(
        `Cet IMEI est déjà enregistré pour un appareil de l'élève ${existant.eleve.matricule}.`,
      );
    }
  }

  /** Crée le comportement négatif quand le seuil mensuel d'usage en classe est atteint. */
  private async appliquerSeuilUsage(
    tx: Prisma.TransactionClient,
    u: UtilisateurConnecte,
    eleveId: string,
    dateHeure: Date,
  ): Promise<boolean> {
    const debut = debutDuMois(dateHeure);
    const fin = new Date(
      Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1),
    );
    const [signalements, dejaCree] = await Promise.all([
      tx.incidentAppareil.count({
        where: {
          type: TypeIncidentAppareil.USAGE_EN_CLASSE,
          appareil: { eleveId },
          dateHeure: { gte: debut, lt: fin },
        },
      }),
      tx.comportement.count({
        where: {
          eleveId,
          categorie: CategorieComportement.USAGE_APPAREIL,
          date: { gte: debut, lt: fin },
        },
      }),
    ]);
    if (!seuilAtteint(signalements, this.seuilUsage, dejaCree > 0))
      return false;

    await tx.comportement.create({
      data: {
        eleveId,
        type: TypeComportement.NEGATIF,
        categorie: CategorieComportement.USAGE_APPAREIL,
        gravite: 1,
        description: `${signalements} utilisations non autorisées d'un appareil en classe ce mois-ci.`,
        date: dateHeure,
        auteurId: u.id,
        creePar: u.id,
      },
    });
    return true;
  }

  private async prevenirParents(
    u: UtilisateurConnecte,
    appareil: AppareilBrut,
    dto: SignalementDto,
    dateHeure: Date,
    comportementCree: boolean,
  ) {
    // Le parent qui déclare lui-même la perte n'a pas besoin d'être prévenu.
    if (u.role === Role.PARENT) return;

    const quoi = `Le ${designation(appareil)} de ${appareil.eleve.prenoms}`;
    const quand = dateHeureFr(dateHeure);
    const precisions = [dto.lieu && `Lieu : ${dto.lieu}.`, dto.commentaire]
      .filter(Boolean)
      .join(' ');
    const messages: Record<TypeIncidentAppareil, string> = {
      DECLARE_PERDU: `${quoi} a été déclaré perdu le ${quand}. Nous vous préviendrons s'il est retrouvé.`,
      TROUVE: `${quoi} a été trouvé le ${quand}. Il est gardé à la vie scolaire, où il peut être récupéré.`,
      CONFISQUE: `${quoi} a été confisqué le ${quand}. Il peut être récupéré à la vie scolaire.`,
      RESTITUE: `${quoi} a été restitué le ${quand}.`,
      USAGE_EN_CLASSE: `${quoi} a été utilisé en classe sans autorisation le ${quand}.`,
    };
    const usage = dto.type === TypeIncidentAppareil.USAGE_EN_CLASSE;

    // Canaux et priorité : ceux du type (cahier des charges, tableau des notifications).
    await this.notifications.notifier({
      ecoleId: u.ecoleId,
      type: usage ? TypeNotification.USAGE_APPAREIL : TypeNotification.APPAREIL,
      cible: { eleveIds: [appareil.eleve.id] },
      variables: {
        details: [messages[dto.type], precisions].filter(Boolean).join(' '),
      },
      sourceType: 'appareil',
      sourceId: appareil.id,
      creePar: u.id,
    });

    if (comportementCree) {
      await this.notifications.notifier({
        ecoleId: u.ecoleId,
        type: TypeNotification.COMPORTEMENT,
        cible: { eleveIds: [appareil.eleve.id] },
        variables: {
          details: `${appareil.eleve.prenoms} a utilisé un appareil en classe sans autorisation ${this.seuilUsage} fois ce mois-ci. Un comportement a été inscrit à son dossier.`,
        },
        sourceType: 'appareil',
        sourceId: appareil.id,
        creePar: u.id,
      });
    }
  }
}
