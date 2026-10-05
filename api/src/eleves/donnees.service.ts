import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ActionAudit, StatutEleve } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockageService } from '../stockage/stockage.service.js';

/** Libellés laissés à la place des données effacées. */
export const EFFACE = { prenoms: 'Élève', nom: 'effacé' } as const;

/**
 * Droits d'une famille sur les données de l'enfant (demande faite à l'école) :
 * copie complète, puis effacement après le départ de l'élève. L'élève n'est
 * jamais supprimé (règle du projet) : il est anonymisé et ses données
 * personnelles sont supprimées.
 */
@Injectable()
export class DonneesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockage: StockageService,
    private readonly audit: AuditService,
  ) {}

  /** Toutes les données de l'élève et de ses tuteurs, en JSON lisible. */
  async exporter(u: UtilisateurConnecte, id: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id, ecoleId: u.ecoleId },
      include: {
        classe: { select: { nom: true, niveau: true } },
        historiqueClasse: {
          select: {
            dateDebut: true,
            dateFin: true,
            classe: { select: { nom: true } },
          },
        },
        tuteurs: {
          select: {
            lien: true,
            principal: true,
            tuteur: {
              select: {
                prenoms: true,
                nom: true,
                contact1: true,
                contact2: true,
                email: true,
                langue: true,
                consentementLe: true,
                consentementVersion: true,
                preferences: {
                  select: { type: true, sms: true, email: true, push: true },
                },
              },
            },
          },
        },
        appareils: { include: { incidents: true } },
        absences: true,
        comportements: true,
        moyennesMatieres: { include: { matiere: { select: { nom: true } } } },
        resultats: true,
        decisions: true,
        rappelsPaiement: true,
        reponsesAnnonce: {
          select: {
            reponse: true,
            commentaire: true,
            creeLe: true,
            annonce: { select: { titre: true, dateDebut: true } },
          },
        },
        notifications: {
          where: { canal: 'APPLICATION' },
          select: {
            type: true,
            sujet: true,
            contenu: true,
            creeLe: true,
            lueLe: true,
          },
          orderBy: { creeLe: 'asc' },
        },
      },
    });
    if (!eleve) throw new NotFoundException('Élève introuvable.');
    await this.audit.journaliser(u, ActionAudit.EXPORT, 'Eleve', id, {
      donneesPersonnelles: true,
    });
    const date = new Date().toISOString().slice(0, 10);
    return {
      nomFichier: `donnees-${eleve.matricule}-${date}.json`,
      contenu: Buffer.from(
        JSON.stringify({ exporteLe: new Date().toISOString(), eleve }, null, 2),
        'utf8',
      ),
      type: 'application/json; charset=utf-8',
    };
  }

  /**
   * Efface les données personnelles d'un élève archivé : identité anonymisée,
   * suivi (absences, comportement, résultats, appareils, messages) supprimé.
   * Un tuteur sans autre enfant à l'école est anonymisé et son compte fermé.
   */
  async effacer(u: UtilisateurConnecte, id: string, confirmation: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id, ecoleId: u.ecoleId },
      include: {
        appareils: { select: { photoUrl: true } },
        tuteurs: {
          select: {
            tuteurId: true,
            tuteur: { select: { _count: { select: { eleves: true } } } },
          },
        },
      },
    });
    if (!eleve) throw new NotFoundException('Élève introuvable.');
    if (eleve.statut !== StatutEleve.ARCHIVE)
      throw new BadRequestException(
        "Archivez d'abord l'élève : l'effacement concerne un élève qui a quitté l'école.",
      );
    if (eleve.prenoms === EFFACE.prenoms && eleve.nom === EFFACE.nom)
      throw new BadRequestException(
        'Les données de cet élève sont déjà effacées.',
      );
    if (confirmation.trim().toUpperCase() !== eleve.matricule)
      throw new BadRequestException(
        `Pour confirmer, saisissez le matricule ${eleve.matricule}.`,
      );

    // Tuteurs dont c'est le seul enfant : leurs données partent aussi.
    const tuteursSeuls = eleve.tuteurs
      .filter((t) => t.tuteur._count.eleves === 1)
      .map((t) => t.tuteurId);
    const fichiers = [
      eleve.photoUrl,
      ...eleve.appareils.map((a) => a.photoUrl),
    ];
    const dateNaissance = new Date(
      Date.UTC(eleve.dateNaissance.getUTCFullYear(), 0, 1),
    );

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { OR: [{ eleveId: id }, { tuteurId: { in: tuteursSeuls } }] },
      }),
      this.prisma.reponseAnnonce.deleteMany({ where: { eleveId: id } }),
      this.prisma.absence.deleteMany({ where: { eleveId: id } }),
      this.prisma.comportement.deleteMany({ where: { eleveId: id } }),
      this.prisma.moyenneMatiere.deleteMany({ where: { eleveId: id } }),
      this.prisma.resultat.deleteMany({ where: { eleveId: id } }),
      this.prisma.decisionAnnuelle.deleteMany({ where: { eleveId: id } }),
      this.prisma.rappelPaiement.deleteMany({ where: { eleveId: id } }),
      this.prisma.note.deleteMany({ where: { eleveId: id } }),
      this.prisma.appareil.deleteMany({ where: { eleveId: id } }),
      this.prisma.eleveTuteur.deleteMany({ where: { eleveId: id } }),
      // L'année de naissance reste pour les statistiques ; le reste disparaît.
      this.prisma.eleve.update({
        where: { id },
        data: {
          prenoms: EFFACE.prenoms,
          nom: EFFACE.nom,
          dateNaissance,
          telephone: null,
          photoUrl: null,
        },
      }),
      ...tuteursSeuls.flatMap((tuteurId) => [
        this.prisma.utilisateur.updateMany({
          where: { tuteur: { id: tuteurId } },
          data: {
            prenoms: 'Tuteur',
            nom: 'effacé',
            telephone: null,
            email: null,
            actif: false,
          },
        }),
        this.prisma.jetonRafraichissement.deleteMany({
          where: { utilisateur: { tuteur: { id: tuteurId } } },
        }),
        this.prisma.jetonPush.deleteMany({
          where: { utilisateur: { tuteur: { id: tuteurId } } },
        }),
        this.prisma.tuteur.update({
          where: { id: tuteurId },
          data: {
            prenoms: 'Tuteur',
            nom: 'effacé',
            // Contact unique par école : une valeur interne, jamais utilisée pour un envoi.
            contact1: `efface:${tuteurId}`,
            contact2: null,
            email: null,
            consentementLe: null,
            consentementVersion: null,
          },
        }),
      ]),
    ]);
    for (const cle of fichiers) if (cle) await this.stockage.supprimer(cle);

    await this.audit.journaliser(u, ActionAudit.SUPPRESSION, 'Eleve', id, {
      effacementDonnees: true,
      tuteursAnonymises: tuteursSeuls.length,
    });
    return { efface: true, tuteursAnonymises: tuteursSeuls.length };
  }
}
