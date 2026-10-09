import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { PAYS } from '../common/pays.js';
import {
  ActionAudit,
  MethodeDoubleAuth,
  Role,
} from '../generated/prisma/enums.js';
import {
  EtatEcolesService,
  MESSAGE_ECOLE_SUSPENDUE,
} from '../plateforme/etat-ecoles.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ChargeJeton,
  Session,
  UtilisateurConnecte,
} from './auth.types.js';
import { DEBLOCAGE, methodeDoubleAuth } from './connexion.regles.js';
import { TEXTE_CONSENTEMENT, VERSION_CONSENTEMENT } from './consentement.js';
import {
  DoubleAuthService,
  type DefiDoubleAuth,
} from './double-auth.service.js';
import {
  messageDesactive,
  VerrouillageService,
} from './verrouillage.service.js';

export const DUREE_RAFRAICHISSEMENT_MS = 30 * 24 * 60 * 60 * 1000;

const empreinte = (jeton: string) =>
  createHash('sha256').update(jeton).digest('hex');

interface UtilisateurSession {
  id: string;
  role: Role;
  /** null : concepteur (SUPER_ADMIN), sans école. */
  ecoleId: string | null;
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
    private readonly etatEcoles: EtatEcolesService,
    private readonly doubleAuth: DoubleAuthService,
    private readonly verrouillage: VerrouillageService,
  ) {}

  /**
   * Étape 1 : email et mot de passe. Renvoie la session, ou l'étape du code
   * (double authentification). Les essais incorrects mènent au blocage progressif.
   */
  async connexionPersonnel(
    email: string,
    motDePasse: string,
  ): Promise<Session | DefiDoubleAuth> {
    const trouve = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    const utilisateur = trouve?.role === Role.PARENT ? null : trouve;
    if (utilisateur?.actif) this.verrouillage.verifierNonBloque(utilisateur);

    this.hashFactice ??= hash('mot-de-passe-factice');
    const motDePasseValide = await verify(
      utilisateur?.motDePasseHash ?? (await this.hashFactice),
      motDePasse,
    );

    if (!utilisateur?.motDePasseHash || !motDePasseValide) {
      if (utilisateur?.actif && utilisateur.motDePasseHash)
        await this.verrouillage.echec(utilisateur);
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    if (!utilisateur.actif) {
      if (utilisateur.verrouilleLe)
        throw new ForbiddenException(messageDesactive(utilisateur.role));
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    // École suspendue : refus avant d'envoyer le moindre code.
    if (
      utilisateur.ecoleId &&
      (await this.etatEcoles.estSuspendue(utilisateur.ecoleId))
    )
      throw new ForbiddenException(MESSAGE_ECOLE_SUSPENDUE);
    const methode = methodeDoubleAuth(utilisateur);
    if (methode) return this.doubleAuth.defi(utilisateur, methode);
    return this.ouvrirSession(utilisateur);
  }

  /** Étape 2 : code de l'application, code reçu par email ou code de secours. */
  async verifierDoubleAuth(jeton: string, code: string): Promise<Session> {
    const utilisateur = await this.compteDuDefi(jeton);
    if (!(await this.doubleAuth.codeValide(utilisateur, code))) {
      await this.verrouillage.echec(utilisateur);
      throw new UnauthorizedException('Code incorrect.');
    }
    return this.ouvrirSession(utilisateur);
  }

  /** Nouveau code par email pendant l'étape 2. */
  async renvoyerCode(jeton: string): Promise<void> {
    const utilisateur = await this.compteDuDefi(jeton);
    if (methodeDoubleAuth(utilisateur) !== MethodeDoubleAuth.EMAIL)
      throw new BadRequestException(
        'Saisissez le code affiché par votre application d’authentification.',
      );
    await this.doubleAuth.envoyerCode(utilisateur);
  }

  private async compteDuDefi(jeton: string) {
    const id = await this.doubleAuth.lireDefi(jeton);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id },
    });
    if (!utilisateur || utilisateur.role === Role.PARENT)
      throw new UnauthorizedException('Session invalide.');
    if (!utilisateur.actif)
      throw new ForbiddenException(
        utilisateur.verrouilleLe
          ? messageDesactive(utilisateur.role)
          : 'Ce compte est désactivé.',
      );
    this.verrouillage.verifierNonBloque(utilisateur);
    return utilisateur;
  }

  /** Émet une nouvelle paire de jetons puis enregistre la connexion. */
  async ouvrirSession(utilisateur: UtilisateurSession): Promise<Session> {
    const session = await this.emettreJetons(utilisateur);
    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      // Connexion réussie : les essais incorrects et les blocages repartent de zéro.
      data: { derniereConnexion: new Date(), ...DEBLOCAGE },
    });
    await this.audit.journaliser(
      session.utilisateur,
      ActionAudit.CONNEXION,
      'Utilisateur',
      utilisateur.id,
    );
    return session;
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
        ecole: { select: { nom: true, pays: true } },
        tuteur: {
          select: { id: true, consentementLe: true, consentementVersion: true },
        },
      },
    });
    if (!utilisateur) throw new UnauthorizedException();
    const { tuteur, ecole, ...reste } = utilisateur;
    return {
      ...reste,
      tuteurId: tuteur?.id ?? null,
      // Pays de l'école : monnaie des montants et indicatif des numéros (null : concepteur).
      ecole: ecole
        ? {
            nom: ecole.nom,
            pays: ecole.pays,
            nomPays: PAYS[ecole.pays].nom,
            monnaie: PAYS[ecole.pays].monnaie,
            indicatif: PAYS[ecole.pays].indicatif,
            exempleTelephone: PAYS[ecole.pays].exemple,
          }
        : null,
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
    // École suspendue (abonnement) : connexion et renouvellement refusés.
    if (
      utilisateur.ecoleId &&
      (await this.etatEcoles.estSuspendue(utilisateur.ecoleId))
    ) {
      throw new ForbiddenException(MESSAGE_ECOLE_SUSPENDUE);
    }
    const tuteurId = utilisateur.tuteur?.id ?? null;
    const charge: ChargeJeton = {
      sub: utilisateur.id,
      role: utilisateur.role,
      ecoleId: utilisateur.ecoleId ?? '',
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
        ecoleId: utilisateur.ecoleId ?? '',
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
