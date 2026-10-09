import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { DEBLOCAGE, SANS_DOUBLE_AUTH } from '../auth/connexion.regles.js';
import { depuisJour, versJour } from '../common/dates.js';
import { Prisma } from '../generated/prisma/client.js';
import { ActionAudit, Role, StatutEleve } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { motDePasseProvisoire } from '../utilisateurs/utilisateurs.regles.js';
import {
  ajouterJours,
  finEssai,
  JOURS_AVERTISSEMENT,
  JOURS_ESSAI,
  JOURS_GRACE,
  periodePayee,
  situationAbonnement,
  TARIFS_GNF,
  type EtatAbonnement,
} from './abonnements.regles.js';
import type {
  CreerEcoleDto,
  FiltreEcolesDto,
  ModifierEcoleDto,
  PaiementAbonnementDto,
} from './plateforme.dto.js';

const ETATS: EtatAbonnement[] = [
  'ESSAI',
  'ACTIF',
  'A_RENOUVELER',
  'EN_RETARD',
  'SUSPENDUE',
];

const selectionEcole = {
  id: true,
  nom: true,
  pays: true,
  adresse: true,
  telephone: true,
  email: true,
  creeLe: true,
  finAbonnement: true,
  suspendueLe: true,
  motifSuspension: true,
  _count: {
    select: {
      eleves: { where: { statut: StatutEleve.ACTIF } },
      tuteurs: true,
      paiementsAbonnement: true,
    },
  },
} satisfies Prisma.EcoleSelect;

type EcoleBrute = Prisma.EcoleGetPayload<{ select: typeof selectionEcole }>;

/** Vue d'une école pour le concepteur : jamais de données d'élève, seulement des comptes. */
function formaterEcole(e: EcoleBrute, aujourdHui = new Date()) {
  const { _count, ...reste } = e;
  const s = situationAbonnement(
    { ...e, aPaye: _count.paiementsAbonnement > 0 },
    aujourdHui,
  );
  return {
    ...reste,
    finAbonnement: versJour(e.finAbonnement),
    abonnement: {
      etat: s.etat,
      essai: s.essai,
      joursRestants: s.joursRestants,
      finGrace: versJour(s.finGrace),
    },
    eleves: _count.eleves,
    familles: _count.tuteurs,
  };
}

/** Année scolaire d'octobre à mi-juillet, en trois trimestres. */
function anneeScolaire(debut: number) {
  const jour = (annee: number, mois: number, j: number) =>
    new Date(Date.UTC(annee, mois - 1, j));
  return {
    libelle: `${debut}-${debut + 1}`,
    dateDebut: jour(debut, 10, 1),
    dateFin: jour(debut + 1, 7, 15),
    periodes: [
      ['Trimestre 1', jour(debut, 10, 1), jour(debut, 12, 20)],
      ['Trimestre 2', jour(debut + 1, 1, 4), jour(debut + 1, 3, 31)],
      ['Trimestre 3', jour(debut + 1, 4, 12), jour(debut + 1, 7, 15)],
    ] as const,
  };
}

/** Rentrée de l'année scolaire en cours : à partir de juillet, celle qui vient. */
const rentreeEnCours = (aujourdHui = new Date()) =>
  aujourdHui.getUTCMonth() >= 6
    ? aujourdHui.getUTCFullYear()
    : aujourdHui.getUTCFullYear() - 1;

/**
 * Espace concepteur : écoles abonnées, abonnements et paiements. Les élèves et
 * les familles ne sont jamais lus, seulement comptés.
 */
@Injectable()
export class PlateformeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async tableauDeBord(aujourdHui = new Date()) {
    const ecoles = (
      await this.prisma.ecole.findMany({
        select: selectionEcole,
        orderBy: { nom: 'asc' },
      })
    ).map((e) => formaterEcole(e, aujourdHui));
    const debutMois = new Date(
      Date.UTC(aujourdHui.getUTCFullYear(), aujourdHui.getUTCMonth(), 1),
    );
    const debutAnnee = new Date(Date.UTC(aujourdHui.getUTCFullYear(), 0, 1));
    const somme = async (depuis: Date) =>
      (
        await this.prisma.paiementAbonnement.aggregate({
          where: { payeLe: { gte: depuis } },
          _sum: { montant: true },
        })
      )._sum.montant ?? 0;

    return {
      ecoles: {
        total: ecoles.length,
        parEtat: Object.fromEntries(
          ETATS.map((etat) => [
            etat,
            ecoles.filter((e) => e.abonnement.etat === etat).length,
          ]),
        ) as Record<EtatAbonnement, number>,
      },
      eleves: ecoles.reduce((s, e) => s + e.eleves, 0),
      familles: ecoles.reduce((s, e) => s + e.familles, 0),
      encaissements: {
        mois: await somme(debutMois),
        annee: await somme(debutAnnee),
      },
      // Écoles à relancer : fin proche, en retard ou suspendues faute de paiement.
      aRelancer: ecoles
        .filter(
          (e) =>
            ['A_RENOUVELER', 'EN_RETARD'].includes(e.abonnement.etat) ||
            (e.abonnement.etat === 'SUSPENDUE' && !e.suspendueLe),
        )
        .sort(
          (a, b) => a.abonnement.joursRestants - b.abonnement.joursRestants,
        ),
      tarifs: TARIFS_GNF,
      regles: {
        joursEssai: JOURS_ESSAI,
        joursAvertissement: JOURS_AVERTISSEMENT,
        joursGrace: JOURS_GRACE,
      },
    };
  }

  async listerEcoles(filtre: FiltreEcolesDto) {
    const ecoles = await this.prisma.ecole.findMany({
      where: filtre.recherche
        ? { nom: { contains: filtre.recherche, mode: 'insensitive' } }
        : {},
      select: selectionEcole,
      orderBy: { nom: 'asc' },
    });
    return ecoles
      .map((e) => formaterEcole(e))
      .filter((e) => !filtre.etat || e.abonnement.etat === filtre.etat);
  }

  async detailEcole(id: string) {
    const ecole = await this.prisma.ecole.findUnique({
      where: { id },
      select: {
        ...selectionEcole,
        _count: {
          select: {
            ...selectionEcole._count.select,
            classes: true,
            utilisateurs: { where: { role: { not: Role.PARENT } } },
          },
        },
        utilisateurs: {
          where: { role: Role.ADMIN },
          select: {
            id: true,
            prenoms: true,
            nom: true,
            email: true,
            actif: true,
            derniereConnexion: true,
            bloqueJusquA: true,
            verrouilleLe: true,
          },
          orderBy: { creeLe: 'asc' },
        },
        paiementsAbonnement: {
          select: {
            id: true,
            formule: true,
            montant: true,
            moyen: true,
            reference: true,
            payeLe: true,
            periodeDebut: true,
            periodeFin: true,
            creeLe: true,
            enregistreur: { select: { prenoms: true, nom: true } },
          },
          orderBy: { periodeFin: 'desc' },
        },
      },
    });
    if (!ecole) throw new NotFoundException('École introuvable.');
    const { utilisateurs, paiementsAbonnement, ...reste } = ecole;
    return {
      ...formaterEcole(reste),
      classes: reste._count.classes,
      personnel: reste._count.utilisateurs,
      tarifs: TARIFS_GNF,
      direction: utilisateurs,
      paiements: paiementsAbonnement.map((p) => ({
        ...p,
        payeLe: versJour(p.payeLe),
        periodeDebut: versJour(p.periodeDebut),
        periodeFin: versJour(p.periodeFin),
      })),
    };
  }

  /** Nouvelle école : année scolaire, trimestres, compte de direction ; 1 mois d'essai. */
  async creerEcole(u: UtilisateurConnecte, dto: CreerEcoleDto) {
    const motDePasse = motDePasseProvisoire();
    const annee = anneeScolaire(dto.anneeRentree ?? rentreeEnCours());
    try {
      const { ecole, direction } = await this.prisma.$transaction(
        async (tx) => {
          const ecole = await tx.ecole.create({
            data: {
              nom: dto.nom,
              pays: dto.pays,
              adresse: dto.adresse,
              telephone: dto.telephone,
              email: dto.email,
              finAbonnement: finEssai(new Date()),
              creePar: u.id,
            },
            select: { id: true },
          });
          await tx.anneeScolaire.create({
            data: {
              ecoleId: ecole.id,
              libelle: annee.libelle,
              dateDebut: annee.dateDebut,
              dateFin: annee.dateFin,
              active: true,
              creePar: u.id,
              periodes: {
                create: annee.periodes.map(
                  ([libelle, dateDebut, dateFin], i) => ({
                    ordre: i + 1,
                    libelle,
                    dateDebut,
                    dateFin,
                  }),
                ),
              },
            },
          });
          const direction = await tx.utilisateur.create({
            data: {
              ecoleId: ecole.id,
              prenoms: dto.directionPrenoms,
              nom: dto.directionNom,
              email: dto.directionEmail,
              role: Role.ADMIN,
              motDePasseHash: await hash(motDePasse),
              creePar: u.id,
            },
            select: { id: true, email: true },
          });
          return { ecole, direction };
        },
      );
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Ecole',
        ecole.id,
        { pays: dto.pays },
        ecole.id,
      );
      return {
        ...(await this.detailEcole(ecole.id)),
        compteDirection: {
          email: direction.email,
          motDePasseProvisoire: motDePasse,
        },
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'Un compte existe déjà avec cet email de direction.',
        );
      throw e;
    }
  }

  async modifierEcole(
    u: UtilisateurConnecte,
    id: string,
    dto: ModifierEcoleDto,
  ) {
    await this.trouver(id);
    await this.prisma.ecole.update({
      where: { id },
      data: {
        nom: dto.nom,
        pays: dto.pays,
        adresse: dto.adresse ?? null,
        telephone: dto.telephone ?? null,
        email: dto.email ?? null,
      },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Ecole',
      id,
      undefined,
      id,
    );
    return this.detailEcole(id);
  }

  /**
   * Paiement reçu (Mobile Money, virement…) : prolonge l'abonnement d'1 mois ou
   * d'1 an à la suite de la période précédente.
   */
  async enregistrerPaiement(
    u: UtilisateurConnecte,
    id: string,
    dto: PaiementAbonnementDto,
  ) {
    const ecole = await this.trouver(id);
    const payeLe = depuisJour(dto.payeLe);
    if (
      Number.isNaN(payeLe.getTime()) ||
      versJour(payeLe) !== dto.payeLe ||
      payeLe > new Date()
    ) {
      throw new BadRequestException(
        'Date de paiement invalide (au plus aujourd’hui).',
      );
    }
    const periode = periodePayee(dto.formule, ecole.finAbonnement, payeLe);
    const montant = dto.montant ?? TARIFS_GNF[dto.formule];
    const paiement = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.paiementAbonnement.create({
        data: {
          ecoleId: id,
          formule: dto.formule,
          montant,
          moyen: dto.moyen,
          reference: dto.reference,
          payeLe,
          periodeDebut: periode.debut,
          periodeFin: periode.fin,
          enregistrePar: u.id,
        },
        select: { id: true },
      });
      await tx.ecole.update({
        where: { id },
        data: { finAbonnement: periode.fin },
      });
      return cree;
    });
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'PaiementAbonnement',
      paiement.id,
      { formule: dto.formule, montant, jusquAu: versJour(periode.fin) },
      id,
    );
    return this.detailEcole(id);
  }

  /** Annule le dernier paiement (saisi par erreur) : l'abonnement revient à la période d'avant. */
  async annulerDernierPaiement(
    u: UtilisateurConnecte,
    id: string,
    paiementId: string,
  ) {
    await this.trouver(id);
    const dernier = await this.prisma.paiementAbonnement.findFirst({
      where: { ecoleId: id },
      orderBy: { periodeFin: 'desc' },
    });
    if (!dernier || dernier.id !== paiementId) {
      throw new BadRequestException(
        'Seul le dernier paiement enregistré peut être annulé.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.paiementAbonnement.delete({ where: { id: paiementId } }),
      this.prisma.ecole.update({
        where: { id },
        data: { finAbonnement: ajouterJours(dernier.periodeDebut, -1) },
      }),
    ]);
    await this.audit.journaliser(
      u,
      ActionAudit.SUPPRESSION,
      'PaiementAbonnement',
      paiementId,
      { montant: dernier.montant },
      id,
    );
    return this.detailEcole(id);
  }

  /** Suspension à la main : plus de connexion ni d'envoi, données conservées. */
  async suspendre(u: UtilisateurConnecte, id: string, motif: string) {
    await this.trouver(id);
    await this.prisma.ecole.update({
      where: { id },
      data: { suspendueLe: new Date(), motifSuspension: motif },
    });
    // Les sessions ouvertes tombent au prochain renouvellement du jeton (15 min au plus).
    await this.prisma.jetonRafraichissement.updateMany({
      where: { utilisateur: { ecoleId: id }, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Ecole',
      id,
      { suspendue: true, motif },
      id,
    );
    return this.detailEcole(id);
  }

  async reactiver(u: UtilisateurConnecte, id: string) {
    await this.trouver(id);
    await this.prisma.ecole.update({
      where: { id },
      data: { suspendueLe: null, motifSuspension: null },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Ecole',
      id,
      { suspendue: false },
      id,
    );
    return this.detailEcole(id);
  }

  /**
   * Directeur qui a perdu son mot de passe, son téléphone, ou dont le compte est
   * bloqué : nouveau mot de passe provisoire, compte réactivé, double
   * authentification remise par email.
   */
  async reinitialiserDirection(
    u: UtilisateurConnecte,
    id: string,
    utilisateurId: string,
  ) {
    const compte = await this.prisma.utilisateur.findFirst({
      where: { id: utilisateurId, ecoleId: id, role: Role.ADMIN },
      select: { id: true, email: true },
    });
    if (!compte)
      throw new NotFoundException('Compte de direction introuvable.');
    const motDePasse = motDePasseProvisoire();
    await this.prisma.utilisateur.update({
      where: { id: compte.id },
      data: {
        motDePasseHash: await hash(motDePasse),
        actif: true,
        ...DEBLOCAGE,
        ...SANS_DOUBLE_AUTH,
      },
    });
    await this.prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId: compte.id, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      compte.id,
      { motDePasseReinitialise: true, reactive: true },
      id,
    );
    return { email: compte.email, motDePasseProvisoire: motDePasse };
  }

  /** Pour la direction d'une école : son abonnement et ses paiements. */
  async abonnementEcole(ecoleId: string) {
    const ecole = await this.detailEcole(ecoleId);
    return {
      nom: ecole.nom,
      finAbonnement: ecole.finAbonnement,
      abonnement: ecole.abonnement,
      tarifs: TARIFS_GNF,
      paiements: ecole.paiements.map(
        ({
          id,
          formule,
          montant,
          moyen,
          reference,
          payeLe,
          periodeDebut,
          periodeFin,
        }) => ({
          id,
          formule,
          montant,
          moyen,
          reference,
          payeLe,
          periodeDebut,
          periodeFin,
        }),
      ),
    };
  }

  private async trouver(id: string) {
    const ecole = await this.prisma.ecole.findUnique({
      where: { id },
      select: { id: true, finAbonnement: true },
    });
    if (!ecole) throw new NotFoundException('École introuvable.');
    return ecole;
  }
}
