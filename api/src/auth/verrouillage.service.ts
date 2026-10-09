import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ActionAudit, type Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailSender } from '../sms/email.sender.js';
import {
  dureeLisible,
  ESSAIS_AVANT_BLOCAGE,
  quiReactive,
  sanction,
} from './connexion.regles.js';

interface Compte {
  id: string;
  role: Role;
  ecoleId: string | null;
  email: string | null;
  bloqueJusquA: Date | null;
}

/**
 * Blocage progressif du personnel : 3 essais incorrects (mot de passe ou code de
 * double authentification) → 30 minutes ; puis 3 heures ; puis compte désactivé,
 * à réactiver par la direction (ou le concepteur pour la direction).
 */
@Injectable()
export class VerrouillageService {
  private readonly logger = new Logger(VerrouillageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailSender,
  ) {}

  /** Refuse tout essai pendant un blocage, sans même vérifier le mot de passe. */
  verifierNonBloque(compte: Compte, maintenant = Date.now()): void {
    const reste = (compte.bloqueJusquA?.getTime() ?? 0) - maintenant;
    if (reste > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Compte bloqué après ${ESSAIS_AVANT_BLOCAGE} essais incorrects. Réessayez dans ${dureeLisible(reste)}.`,
          reessayerDansS: Math.ceil(reste / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Compte un essai incorrect. Au 3e, bloque le compte ou le désactive et lève
   * l'erreur correspondante ; sinon ne fait rien (l'appelant répond 401).
   */
  async echec(compte: Compte): Promise<void> {
    const { echecsConnexion } = await this.prisma.utilisateur.update({
      where: { id: compte.id },
      data: { echecsConnexion: { increment: 1 } },
      select: { echecsConnexion: true },
    });
    if (echecsConnexion < ESSAIS_AVANT_BLOCAGE) return;

    // Une seule requête applique le blocage, même si des essais arrivent en même temps.
    const { count } = await this.prisma.utilisateur.updateMany({
      where: {
        id: compte.id,
        echecsConnexion: { gte: ESSAIS_AVANT_BLOCAGE },
      },
      data: { echecsConnexion: 0, blocages: { increment: 1 } },
    });
    if (count === 0) return;
    const { blocages } = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: compte.id },
      select: { blocages: true },
    });

    const s = sanction(blocages);
    if (s.type === 'blocage') {
      await this.prisma.utilisateur.update({
        where: { id: compte.id },
        data: { bloqueJusquA: new Date(Date.now() + s.dureeMs) },
      });
      const duree = dureeLisible(s.dureeMs);
      await this.journaliser(compte, { blocage: duree });
      await this.prevenir(
        compte,
        'Compte bloqué temporairement',
        `Suivi_eleve : ${ESSAIS_AVANT_BLOCAGE} essais de connexion incorrects sur votre compte. Il est bloqué pendant ${duree}. Si ce n'était pas vous, changez votre mot de passe dès que possible et prévenez la direction de l'école.`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `${ESSAIS_AVANT_BLOCAGE} essais incorrects : compte bloqué pendant ${duree}.`,
          reessayerDansS: Math.ceil(s.dureeMs / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.$transaction([
      this.prisma.utilisateur.update({
        where: { id: compte.id },
        data: { actif: false, verrouilleLe: new Date(), bloqueJusquA: null },
      }),
      this.prisma.jetonRafraichissement.updateMany({
        where: { utilisateurId: compte.id, revoqueLe: null },
        data: { revoqueLe: new Date() },
      }),
    ]);
    await this.journaliser(compte, { desactiveApresEssais: true });
    await this.prevenir(
      compte,
      'Compte désactivé',
      `Suivi_eleve : trop d'essais de connexion incorrects sur votre compte, il est désactivé. ${quiReactive(compte.role)}`,
    );
    throw new ForbiddenException(messageDesactive(compte.role));
  }

  private journaliser(compte: Compte, details: Record<string, unknown>) {
    return this.audit.journaliser(
      {
        id: compte.id,
        role: compte.role,
        ecoleId: compte.ecoleId ?? '',
        tuteurId: null,
      },
      ActionAudit.MODIFICATION,
      'Utilisateur',
      compte.id,
      details as Record<string, string | boolean>,
    );
  }

  /** L'alerte par email ne doit jamais empêcher de répondre. */
  private async prevenir(compte: Compte, sujet: string, texte: string) {
    if (!compte.email) return;
    await this.email
      .envoyer(compte.email, sujet, texte)
      .catch((e: unknown) =>
        this.logger.warn(`Alerte de blocage non envoyée : ${String(e)}`),
      );
  }
}

/** Message d'un compte désactivé après le 3e blocage. */
export const messageDesactive = (role: Role) =>
  `Compte désactivé après trop d'essais de connexion incorrects. ${quiReactive(role)}`;
