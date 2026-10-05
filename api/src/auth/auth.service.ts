import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { ActionAudit, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ChargeJeton,
  Session,
  UtilisateurConnecte,
} from './auth.types.js';
import { TEXTE_CONSENTEMENT, VERSION_CONSENTEMENT } from './consentement.js';

export const DUREE_RAFRAICHISSEMENT_MS = 30 * 24 * 60 * 60 * 1000;

const empreinte = (jeton: string) =>
  createHash('sha256').update(jeton).digest('hex');

interface UtilisateurSession {
  id: string;
  role: Role;
  ecoleId: string;
  tuteur?: { id: string } | null;
}

@Injectable()
export class AuthService {
  // Hash calculé une fois pour vérifier un mot de passe même quand l'email est inconnu :
  // le temps de réponse ne révèle pas si un compte existe.
  private hashFactice?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async connexionPersonnel(
    email: string,
    motDePasse: string,
  ): Promise<Session> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    this.hashFactice ??= hash('mot-de-passe-factice');
    const motDePasseValide = await verify(
      utilisateur?.motDePasseHash ?? (await this.hashFactice),
      motDePasse,
    );

    if (
      !utilisateur?.motDePasseHash ||
      !motDePasseValide ||
      !utilisateur.actif ||
      utilisateur.role === Role.PARENT
    ) {
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    return this.ouvrirSession(utilisateur);
  }

  /** Enregistre la connexion et émet une nouvelle paire de jetons. */
  async ouvrirSession(utilisateur: UtilisateurSession): Promise<Session> {
    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { derniereConnexion: new Date() },
    });
    await this.audit.journaliser(
      {
        id: utilisateur.id,
        role: utilisateur.role,
        ecoleId: utilisateur.ecoleId,
        tuteurId: utilisateur.tuteur?.id ?? null,
      },
      ActionAudit.CONNEXION,
      'Utilisateur',
      utilisateur.id,
    );
    return this.emettreJetons(utilisateur);
  }

  async rafraichir(jeton: string): Promise<Session> {
    const enregistrement = await this.prisma.jetonRafraichissement.findUnique({
      where: { jetonHash: empreinte(jeton) },
      include: {
        utilisateur: { include: { tuteur: { select: { id: true } } } },
      },
    });
    if (!enregistrement) throw new UnauthorizedException('Session invalide.');

    if (enregistrement.revoqueLe) {
      // Un jeton déjà utilisé revient : il a pu être volé. On ferme toutes les sessions.
      await this.revoquerTout(enregistrement.utilisateurId);
      throw new UnauthorizedException('Session révoquée. Reconnectez-vous.');
    }
    if (
      enregistrement.expireLe < new Date() ||
      !enregistrement.utilisateur.actif
    ) {
      throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    }

    // Rotation : le jeton présenté est révoqué une seule fois, même en cas d'appels simultanés.
    const { count } = await this.prisma.jetonRafraichissement.updateMany({
      where: { id: enregistrement.id, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    if (count === 0) {
      throw new UnauthorizedException('Session révoquée. Reconnectez-vous.');
    }
    return this.emettreJetons(enregistrement.utilisateur);
  }

  async deconnexion(jeton: string): Promise<void> {
    await this.prisma.jetonRafraichissement.updateMany({
      where: { jetonHash: empreinte(jeton), revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }

  async profil(utilisateurId: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: {
        id: true,
        prenoms: true,
        nom: true,
        email: true,
        telephone: true,
        role: true,
        ecoleId: true,
        tuteur: {
          select: { id: true, consentementLe: true, consentementVersion: true },
        },
      },
    });
    if (!utilisateur) throw new UnauthorizedException();
    const { tuteur, ...reste } = utilisateur;
    return {
      ...reste,
      tuteurId: tuteur?.id ?? null,
      // Parent : texte à accepter à la première connexion (ou quand il change).
      consentement: tuteur
        ? {
            version: VERSION_CONSENTEMENT,
            texte: TEXTE_CONSENTEMENT,
            accepte: tuteur.consentementVersion === VERSION_CONSENTEMENT,
            accepteLe: tuteur.consentementLe,
          }
        : null,
    };
  }

  /** Le parent accepte la version courante du texte d'information. */
  async consentir(u: UtilisateurConnecte, version: string) {
    if (version !== VERSION_CONSENTEMENT) {
      throw new BadRequestException(
        'Le texte a changé : relisez-le avant de l’accepter.',
      );
    }
    await this.prisma.tuteur.update({
      where: { id: u.tuteurId ?? '' },
      data: { consentementLe: new Date(), consentementVersion: version },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Tuteur',
      u.tuteurId ?? undefined,
      { consentement: version },
    );
    return this.profil(u.id);
  }

  private async emettreJetons(
    utilisateur: UtilisateurSession,
  ): Promise<Session> {
    const tuteurId = utilisateur.tuteur?.id ?? null;
    const charge: ChargeJeton = {
      sub: utilisateur.id,
      role: utilisateur.role,
      ecoleId: utilisateur.ecoleId,
      ...(tuteurId ? { tuteurId } : {}),
    };
    const jetonAcces = await this.jwt.signAsync(charge);

    const jetonRafraichissement = randomBytes(32).toString('base64url');
    await this.prisma.jetonRafraichissement.create({
      data: {
        utilisateurId: utilisateur.id,
        jetonHash: empreinte(jetonRafraichissement),
        expireLe: new Date(Date.now() + DUREE_RAFRAICHISSEMENT_MS),
      },
    });

    return {
      jetonAcces,
      jetonRafraichissement,
      utilisateur: {
        id: utilisateur.id,
        role: utilisateur.role,
        ecoleId: utilisateur.ecoleId,
        tuteurId,
      },
    };
  }

  private async revoquerTout(utilisateurId: string): Promise<void> {
    await this.prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }
}
