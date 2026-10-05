import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { page, sauter } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  CanalNotification,
  Langue,
  StatutEleve,
  StatutNotification,
  type PrioriteNotification,
  type TypeNotification,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnvoiService } from './envoi.service.js';
import {
  MODELES_PAR_DEFAUT,
  type CanalModele,
  type Modele,
} from './modeles.defaut.js';
import type { FiltreJournalDto, PreferencesDto } from './notifications.dto.js';
import {
  enumerer,
  preparerSms,
  REGLES_TYPE,
  rendre,
} from './notifications.regles.js';

export interface DemandeNotification {
  ecoleId: string;
  type: TypeNotification;
  /** Élèves précis, classes entières ou toute l'école (élèves actifs). */
  cible: { eleveIds?: string[]; classeIds?: string[]; ecole?: boolean };
  /** Variables des modèles : {heure}, {motif}, {montant}, {details}… */
  variables?: Record<string, string | undefined>;
  priorite?: PrioriteNotification;
  /** Par défaut : les canaux du type (tableau du cahier des charges). */
  canaux?: CanalNotification[];
  sourceType?: string;
  sourceId?: string;
  /** Empêche d'envoyer deux fois le même message au même tuteur (ex. relances). */
  cleDeduplication?: string;
  creePar?: string;
}

export interface ResultatNotification {
  /** Tuteurs prévenus (un message chacun, même avec plusieurs enfants). */
  tuteurs: number;
  /** Envois mis en file, tous canaux confondus. */
  envois: number;
}

/** Une ligne par canal d'un même message, regroupées par `lotId`. */
type Ligne = Prisma.NotificationCreateManyInput;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly plafondSms: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly envoi: EnvoiService,
    config: ConfigService,
  ) {
    this.plafondSms = Number(config.get('SMS_PLAFOND_MENSUEL', 0)) || 0;
  }

  async notifier(demande: DemandeNotification): Promise<ResultatNotification> {
    const regle = REGLES_TYPE[demande.type];
    const canaux = demande.canaux ?? regle.canaux;
    const priorite = demande.priorite ?? regle.priorite;

    const { eleveIds, classeIds, ecole } = demande.cible;
    const eleves = await this.prisma.eleve.findMany({
      where: {
        ecoleId: demande.ecoleId,
        ...(eleveIds
          ? { id: { in: eleveIds } }
          : {
              statut: StatutEleve.ACTIF,
              ...(ecole ? {} : { classeId: { in: classeIds ?? [] } }),
            }),
      },
      select: {
        id: true,
        prenoms: true,
        nom: true,
        classe: { select: { nom: true } },
        ecole: { select: { nom: true } },
        tuteurs: {
          select: {
            tuteur: {
              select: {
                id: true,
                prenoms: true,
                contact1: true,
                email: true,
                langue: true,
                utilisateur: {
                  select: { jetonsPush: { select: { jeton: true } } },
                },
                preferences: { where: { type: demande.type } },
              },
            },
          },
        },
      },
      orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
    });

    // Un message par tuteur, qui cite tous ses enfants concernés.
    const parTuteur = new Map<
      string,
      {
        tuteur: (typeof eleves)[number]['tuteurs'][number]['tuteur'];
        eleves: typeof eleves;
      }
    >();
    for (const eleve of eleves) {
      for (const { tuteur } of eleve.tuteurs) {
        const entree = parTuteur.get(tuteur.id) ?? { tuteur, eleves: [] };
        entree.eleves.push(eleve);
        parTuteur.set(tuteur.id, entree);
      }
    }

    const dejaEnvoyes = new Set<string>();
    if (demande.cleDeduplication) {
      const existants = await this.prisma.notification.findMany({
        where: {
          cleDeduplication: {
            in: [...parTuteur.keys()].map(
              (id) => `${demande.cleDeduplication}:${id}`,
            ),
          },
        },
        select: { tuteurId: true },
      });
      existants.forEach((e) => dejaEnvoyes.add(e.tuteurId));
    }

    const modeles = await this.modelesEcole(demande.ecoleId, demande.type);
    let smsRestants = await this.smsRestants(
      demande.ecoleId,
      regle.obligatoire,
    );

    const lignes: Ligne[] = [];
    let tuteurs = 0;
    for (const { tuteur, eleves: enfants } of parTuteur.values()) {
      if (dejaEnvoyes.has(tuteur.id)) continue;
      tuteurs++;
      const preference = tuteur.preferences[0];
      const accepte = (canal: 'sms' | 'email' | 'push') =>
        regle.obligatoire || !preference || preference[canal];
      const modele = (canal: CanalModele): Modele =>
        modeles.get(`${canal}:${tuteur.langue}`) ??
        modeles.get(`${canal}:${Langue.FR}`) ??
        MODELES_PAR_DEFAUT[demande.type][canal];
      const variables = {
        ecole: enfants[0].ecole.nom,
        prenom_tuteur: tuteur.prenoms,
        prenom_eleve: enumerer(enfants.map((e) => e.prenoms)),
        nom_eleve: enumerer(enfants.map((e) => e.nom)),
        classe: enumerer(enfants.map((e) => e.classe?.nom ?? '')),
        ...demande.variables,
      };
      const commun = {
        lotId: randomUUID(),
        ecoleId: demande.ecoleId,
        type: demande.type,
        priorite,
        tuteurId: tuteur.id,
        eleveId: enfants[0].id,
        sourceType: demande.sourceType,
        sourceId: demande.sourceId,
        creePar: demande.creePar,
      };
      const email = modele('EMAIL');
      const push = modele('PUSH');

      // Historique dans l'application : toujours, quelles que soient les préférences.
      lignes.push({
        ...commun,
        canal: CanalNotification.APPLICATION,
        destinataire: tuteur.id,
        sujet: rendre(email.sujet ?? '', variables),
        contenu: rendre(email.contenu, variables),
        statut: StatutNotification.DELIVREE,
        delivreeLe: new Date(),
        cleDeduplication: demande.cleDeduplication
          ? `${demande.cleDeduplication}:${tuteur.id}`
          : undefined,
      });
      if (canaux.includes(CanalNotification.SMS) && accepte('sms')) {
        if (smsRestants > 0) {
          smsRestants--;
          lignes.push({
            ...commun,
            canal: CanalNotification.SMS,
            destinataire: tuteur.contact1,
            contenu: preparerSms(rendre(modele('SMS').contenu, variables)),
          });
        } else {
          this.logger.warn(
            `Plafond mensuel de SMS atteint : SMS non envoyé au tuteur ${tuteur.id}.`,
          );
        }
      }
      if (
        canaux.includes(CanalNotification.EMAIL) &&
        accepte('email') &&
        tuteur.email
      ) {
        lignes.push({
          ...commun,
          canal: CanalNotification.EMAIL,
          destinataire: tuteur.email,
          sujet: rendre(email.sujet ?? '', variables),
          contenu: rendre(email.contenu, variables),
        });
      }
      if (canaux.includes(CanalNotification.PUSH) && accepte('push')) {
        for (const { jeton } of tuteur.utilisateur?.jetonsPush ?? []) {
          lignes.push({
            ...commun,
            canal: CanalNotification.PUSH,
            destinataire: jeton,
            sujet: rendre(push.sujet ?? '', variables),
            contenu: rendre(push.contenu, variables),
          });
        }
      }
    }

    if (!lignes.length) return { tuteurs: 0, envois: 0 };
    const crees = await this.prisma.notification.createManyAndReturn({
      data: lignes,
      select: { id: true, canal: true, priorite: true },
    });
    const aEnvoyer = crees.filter(
      (n) => n.canal !== CanalNotification.APPLICATION,
    );
    await this.envoi.ajouter(aEnvoyer);
    this.logger.log(
      `${demande.type} : ${tuteurs} tuteur(s), ${aEnvoyer.length} envoi(s) en file.`,
    );
    return { tuteurs, envois: aEnvoyer.length };
  }

  /** Modèles personnalisés de l'école pour ce type, par « canal:langue ». */
  private async modelesEcole(ecoleId: string, type: TypeNotification) {
    const personnalises = await this.prisma.modeleMessage.findMany({
      where: { ecoleId, type },
    });
    return new Map<string, Modele>(
      personnalises.map((m) => [
        `${m.canal}:${m.langue}`,
        {
          sujet:
            m.sujet ?? MODELES_PAR_DEFAUT[type][m.canal as CanalModele]?.sujet,
          contenu: m.contenu,
        },
      ]),
    );
  }

  /** SMS encore autorisés ce mois-ci (SMS_PLAFOND_MENSUEL, 0 = illimité). */
  private async smsRestants(
    ecoleId: string,
    obligatoire: boolean,
  ): Promise<number> {
    if (!this.plafondSms || obligatoire) return Number.POSITIVE_INFINITY;
    const debut = new Date();
    debut.setUTCDate(1);
    debut.setUTCHours(0, 0, 0, 0);
    const consommes = await this.prisma.notification.count({
      where: {
        ecoleId,
        canal: CanalNotification.SMS,
        statut: { not: StatutNotification.ECHOUEE },
        creeLe: { gte: debut },
      },
    });
    return Math.max(0, this.plafondSms - consommes);
  }

  // ─── Consultation ──────────────────────────────────────────────────────────

  /** Journal des envois pour l'administration (EF-83). */
  async journal(u: UtilisateurConnecte, filtre: FiltreJournalDto) {
    const where: Prisma.NotificationWhereInput = {
      ecoleId: u.ecoleId,
      canal: filtre.canal ?? { not: CanalNotification.APPLICATION },
      type: filtre.type,
      statut: filtre.statut,
      eleveId: filtre.eleveId,
      tuteurId: filtre.tuteurId,
      creeLe: {
        gte: filtre.du ? new Date(`${filtre.du}T00:00:00Z`) : undefined,
        lt: filtre.au
          ? new Date(new Date(`${filtre.au}T00:00:00Z`).getTime() + 86_400_000)
          : undefined,
      },
      ...(filtre.q
        ? {
            destinataire: {
              contains: filtre.q.replace(/\s/g, ''),
              mode: 'insensitive',
            },
          }
        : {}),
    };
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          lotId: true,
          type: true,
          canal: true,
          priorite: true,
          statut: true,
          destinataire: true,
          sujet: true,
          contenu: true,
          essais: true,
          erreur: true,
          fournisseur: true,
          cout: true,
          creeLe: true,
          envoyeeLe: true,
          delivreeLe: true,
          lueLe: true,
          tuteur: { select: { id: true, prenoms: true, nom: true } },
          eleve: { select: { id: true, prenoms: true, nom: true } },
        },
        orderBy: { creeLe: 'desc' },
        ...sauter(filtre),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return page(notifications, total, filtre);
  }

  /** Bilan d'un mois : envois par canal et statut, coût des SMS (EF-83, plafond). */
  async statistiques(u: UtilisateurConnecte, mois?: string) {
    const [annee, m] = (mois ?? new Date().toISOString().slice(0, 7))
      .split('-')
      .map(Number);
    const debut = new Date(Date.UTC(annee, m - 1, 1));
    const fin = new Date(Date.UTC(annee, m, 1));
    const groupes = await this.prisma.notification.groupBy({
      by: ['canal', 'statut'],
      where: {
        ecoleId: u.ecoleId,
        canal: { not: CanalNotification.APPLICATION },
        creeLe: { gte: debut, lt: fin },
      },
      _count: { _all: true },
      _sum: { cout: true },
    });
    const parCanal: Record<string, Record<string, number>> = {};
    let coutSms = 0;
    let sms = 0;
    for (const g of groupes) {
      parCanal[g.canal] ??= {};
      parCanal[g.canal][g.statut] = g._count._all;
      if (g.canal === CanalNotification.SMS) {
        coutSms += g._sum.cout ?? 0;
        if (g.statut !== StatutNotification.ECHOUEE) sms += g._count._all;
      }
    }
    return {
      mois: debut.toISOString().slice(0, 7),
      parCanal,
      sms: { envoyes: sms, cout: coutSms, plafond: this.plafondSms || null },
    };
  }

  /** Historique du parent : un message par lot (EF-32). */
  async mesNotifications(
    u: UtilisateurConnecte,
    filtre: { page: number; parPage: number },
  ) {
    const where: Prisma.NotificationWhereInput = {
      tuteurId: u.tuteurId ?? '',
      canal: CanalNotification.APPLICATION,
    };
    const [notifications, total, nonLues] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          priorite: true,
          sujet: true,
          contenu: true,
          creeLe: true,
          lueLe: true,
          eleve: { select: { id: true, prenoms: true } },
        },
        orderBy: { creeLe: 'desc' },
        ...sauter(filtre),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, lueLe: null } }),
    ]);
    return { ...page(notifications, total, filtre), nonLues };
  }

  /** Accusé de lecture par le parent : l'école voit qui a lu (EF-32). */
  async marquerLue(u: UtilisateurConnecte, id: string) {
    const n = await this.prisma.notification.findFirst({
      where: {
        id,
        tuteurId: u.tuteurId ?? '',
        canal: CanalNotification.APPLICATION,
      },
      select: { lotId: true, lueLe: true },
    });
    if (!n) throw new NotFoundException('Notification introuvable.');
    if (!n.lueLe) {
      const maintenant = new Date();
      await this.prisma.notification.updateMany({
        where: { lotId: n.lotId, canal: CanalNotification.APPLICATION },
        data: { lueLe: maintenant, statut: StatutNotification.LUE },
      });
    }
    return { lue: true };
  }

  /** Préférences du parent par type : obligatoires signalés, non modifiables (EF-84). */
  async preferences(u: UtilisateurConnecte) {
    const enregistrees = await this.prisma.preferenceNotification.findMany({
      where: { tuteurId: u.tuteurId ?? '' },
    });
    return (Object.keys(REGLES_TYPE) as TypeNotification[]).map((type) => {
      const p = enregistrees.find((e) => e.type === type);
      const regle = REGLES_TYPE[type];
      return {
        type,
        obligatoire: regle.obligatoire,
        canauxDisponibles: regle.canaux,
        sms: regle.obligatoire || (p?.sms ?? true),
        email: regle.obligatoire || (p?.email ?? true),
        push: regle.obligatoire || (p?.push ?? true),
      };
    });
  }

  async enregistrerPreferences(u: UtilisateurConnecte, dto: PreferencesDto) {
    const tuteurId = u.tuteurId ?? '';
    await this.prisma.$transaction(
      dto.preferences
        .filter((p) => !REGLES_TYPE[p.type].obligatoire)
        .map((p) =>
          this.prisma.preferenceNotification.upsert({
            where: { tuteurId_type: { tuteurId, type: p.type } },
            update: { sms: p.sms, email: p.email, push: p.push },
            create: {
              tuteurId,
              type: p.type,
              sms: p.sms,
              email: p.email,
              push: p.push,
            },
          }),
        ),
    );
    return this.preferences(u);
  }
}
