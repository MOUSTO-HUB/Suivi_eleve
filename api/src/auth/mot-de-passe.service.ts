import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import {
  ActionAudit,
  ButCodeVerification,
  Role,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailSender } from '../sms/email.sender.js';
import { erreurMotDePasse } from '../utilisateurs/utilisateurs.regles.js';

export const DUREE_LIEN_MS = 30 * 60 * 1000;
const LIENS_MAX = 3;
const FENETRE_LIENS_MS = 15 * 60 * 1000;

const empreinte = (jeton: string) =>
  createHash('sha256').update(jeton).digest('hex');

/**
 * « Mot de passe oublié » du personnel : lien par email, valable 30 minutes et
 * une seule fois. Après le changement, toutes les sessions sont fermées.
 */
@Injectable()
export class MotDePasseService {
  private readonly logger = new Logger(MotDePasseService.name);
  private readonly urlSite: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailSender,
    config: ConfigService,
  ) {
    this.urlSite = config
      .get<string>('WEB_URL', 'http://localhost:3001')
      .replace(/\/$/, '');
  }

  /** Ne révèle jamais si l'email est connu : la réponse est la même dans tous les cas. */
  async demander(adresse: string): Promise<void> {
    const compte = await this.prisma.utilisateur.findUnique({
      where: { email: adresse },
      select: { id: true, email: true, role: true, actif: true },
    });
    if (!compte?.email || !compte.actif || compte.role === Role.PARENT) return;

    const recents = await this.prisma.codeVerification.count({
      where: {
        utilisateurId: compte.id,
        but: ButCodeVerification.REINITIALISATION,
        creeLe: { gte: new Date(Date.now() - FENETRE_LIENS_MS) },
      },
    });
    if (recents >= LIENS_MAX) return;

    const jeton = randomBytes(32).toString('base64url');
    // Un nouveau lien annule les précédents.
    await this.prisma.$transaction([
      this.prisma.codeVerification.updateMany({
        where: {
          utilisateurId: compte.id,
          but: ButCodeVerification.REINITIALISATION,
          consommeLe: null,
        },
        data: { consommeLe: new Date() },
      }),
      this.prisma.codeVerification.create({
        data: {
          utilisateurId: compte.id,
          but: ButCodeVerification.REINITIALISATION,
          codeHash: empreinte(jeton),
          expireLe: new Date(Date.now() + DUREE_LIEN_MS),
        },
      }),
    ]);
    await this.email
      .envoyer(
        compte.email,
        'Mot de passe oublié',
        `Suivi_eleve : pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes, une seule fois) : ${this.urlSite}/mot-de-passe/nouveau?jeton=${jeton} — Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.`,
      )
      .catch((e: unknown) =>
        this.logger.warn(`Lien de mot de passe non envoyé : ${String(e)}`),
      );
  }

  async reinitialiser(jeton: string, nouveau: string): Promise<void> {
    const erreur = erreurMotDePasse(nouveau);
    if (erreur) throw new BadRequestException(erreur);

    const lien = await this.prisma.codeVerification.findFirst({
      where: {
        codeHash: empreinte(jeton),
        but: ButCodeVerification.REINITIALISATION,
        consommeLe: null,
        expireLe: { gt: new Date() },
      },
      include: {
        utilisateur: {
          select: { id: true, email: true, role: true, ecoleId: true },
        },
      },
    });
    // Le lien est consommé une seule fois, même en cas d'envois simultanés.
    const consomme = lien
      ? await this.prisma.codeVerification.updateMany({
          where: { id: lien.id, consommeLe: null },
          data: { consommeLe: new Date() },
        })
      : { count: 0 };
    if (!lien || consomme.count === 0)
      throw new BadRequestException(
        'Lien invalide ou expiré. Refaites une demande « Mot de passe oublié ».',
      );

    const compte = lien.utilisateur;
    await this.prisma.$transaction([
      this.prisma.utilisateur.update({
        where: { id: compte.id },
        // Le blocage temporaire est levé (la personne a prouvé qu'elle lit ses emails) ;
        // un compte désactivé le reste.
        data: {
          motDePasseHash: await hash(nouveau),
          echecsConnexion: 0,
          bloqueJusquA: null,
        },
      }),
      this.prisma.jetonRafraichissement.updateMany({
        where: { utilisateurId: compte.id, revoqueLe: null },
        data: { revoqueLe: new Date() },
      }),
    ]);
    await this.audit.journaliser(
      {
        id: compte.id,
        role: compte.role,
        ecoleId: compte.ecoleId ?? '',
        tuteurId: null,
      },
      ActionAudit.MODIFICATION,
      'Utilisateur',
      compte.id,
      { motDePasseOublie: true },
    );
    if (compte.email)
      await this.email
        .envoyer(
          compte.email,
          'Mot de passe changé',
          "Suivi_eleve : le mot de passe de votre compte vient d'être changé et toutes vos sessions ont été fermées. Si ce n'était pas vous, prévenez immédiatement la direction de l'école.",
        )
        .catch((e: unknown) =>
          this.logger.warn(`Confirmation non envoyée : ${String(e)}`),
        );
  }
}
