import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { randomInt } from 'node:crypto';
import { Role } from '../generated/prisma/enums.js';
import { EtatEcolesService } from '../plateforme/etat-ecoles.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailSender } from '../sms/email.sender.js';
import { SmsSender } from '../sms/sms.sender.js';
import { AuthService } from './auth.service.js';
import type { Session } from './auth.types.js';

export const DUREE_VALIDITE_OTP_MS = 5 * 60 * 1000;
export const ESSAIS_MAX_OTP = 3;
export const DEMANDES_MAX_OTP = 3;
export const FENETRE_DEMANDES_OTP_MS = 15 * 60 * 1000;

/** Moyen de recevoir le code à 6 chiffres. */
export type CanalCode = 'SMS' | 'EMAIL';

const CODE_INVALIDE = 'Code invalide ou expiré. Demandez un nouveau code.';

/**
 * Connexion des parents par numéro de téléphone et code à 6 chiffres reçu par SMS
 * ou par email (adresse de la fiche du tuteur). Voir aussi ConnexionWhatsappService.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly email: EmailSender,
    private readonly auth: AuthService,
    private readonly etatEcoles: EtatEcolesService,
  ) {}

  /** Ne révèle jamais si le numéro est connu : la réponse est la même dans tous les cas. */
  async demanderCode(
    telephone: string,
    canal: CanalCode = 'SMS',
  ): Promise<void> {
    if (canal === 'SMS' && !this.sms.disponible()) {
      throw new BadRequestException(
        "L'envoi du code par SMS n'est pas disponible. Choisissez l'email ou WhatsApp.",
      );
    }
    const demandesRecentes = await this.prisma.codeOtp.count({
      where: {
        telephone,
        creeLe: { gte: new Date(Date.now() - FENETRE_DEMANDES_OTP_MS) },
      },
    });
    if (demandesRecentes >= DEMANDES_MAX_OTP) {
      throw new HttpException(
        'Trop de demandes de code. Réessayez dans 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const tuteur = await this.trouverTuteur(telephone);
    // École suspendue, ou pas d'email pour ce tuteur : rien n'est envoyé (la réponse reste la même).
    if (!tuteur || (await this.etatEcoles.estSuspendue(tuteur.ecoleId))) return;
    if (canal === 'EMAIL' && !tuteur.email) return;

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await hash(code);
    // Un nouveau code annule les précédents.
    await this.prisma.$transaction([
      this.prisma.codeOtp.updateMany({
        where: { telephone, consommeLe: null },
        data: { consommeLe: new Date() },
      }),
      this.prisma.codeOtp.create({
        data: {
          telephone,
          codeHash,
          expireLe: new Date(Date.now() + DUREE_VALIDITE_OTP_MS),
        },
      }),
    ]);

    const texte = `Suivi_eleve : votre code de connexion est ${code}. Il expire dans 5 minutes. Ne le communiquez à personne.`;
    if (canal === 'EMAIL' && tuteur.email) {
      await this.email.envoyer(
        tuteur.email,
        `Votre code de connexion Suivi_eleve : ${code}`,
        `Bonjour ${tuteur.prenoms},\n\n${texte}\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`,
      );
    } else {
      await this.sms.envoyer(telephone, texte);
    }
  }

  async verifierCode(telephone: string, code: string): Promise<Session> {
    const otp = await this.prisma.codeOtp.findFirst({
      where: { telephone, consommeLe: null },
      orderBy: { creeLe: 'desc' },
    });
    if (!otp || otp.expireLe < new Date()) {
      throw new UnauthorizedException(CODE_INVALIDE);
    }

    // L'essai est compté avant la vérification : des appels simultanés ne dépassent pas 3 essais.
    const { count } = await this.prisma.codeOtp.updateMany({
      where: { id: otp.id, consommeLe: null, essais: { lt: ESSAIS_MAX_OTP } },
      data: { essais: { increment: 1 } },
    });
    if (count === 0) throw new UnauthorizedException(CODE_INVALIDE);

    if (!(await verify(otp.codeHash, code))) {
      const restants = ESSAIS_MAX_OTP - (otp.essais + 1);
      if (restants <= 0) {
        await this.consommer(otp.id);
        throw new UnauthorizedException(
          'Code incorrect. Nombre maximal d’essais atteint : demandez un nouveau code.',
        );
      }
      throw new UnauthorizedException(
        `Code incorrect. Essai(s) restant(s) : ${restants}.`,
      );
    }

    if (!(await this.consommer(otp.id))) {
      throw new UnauthorizedException(CODE_INVALIDE);
    }
    return this.ouvrirSessionParent(telephone, CODE_INVALIDE);
  }

  /**
   * Session du parent dont le numéro vient d'être prouvé (code reçu, ou message
   * WhatsApp envoyé depuis ce numéro).
   */
  async ouvrirSessionParent(
    telephone: string,
    refus = CODE_INVALIDE,
  ): Promise<Session> {
    const tuteur = await this.trouverTuteur(telephone);
    if (!tuteur) throw new UnauthorizedException(refus);

    // Premier passage : le compte parent est créé et rattaché au tuteur.
    const utilisateur =
      tuteur.utilisateur ??
      (await this.prisma.utilisateur.create({
        data: {
          ecoleId: tuteur.ecoleId,
          prenoms: tuteur.prenoms,
          nom: tuteur.nom,
          telephone,
          email: null,
          role: Role.PARENT,
          tuteur: { connect: { id: tuteur.id } },
        },
      }));

    if (!utilisateur.actif || utilisateur.role !== Role.PARENT) {
      throw new UnauthorizedException('Ce compte est désactivé.');
    }
    return this.auth.ouvrirSession({
      ...utilisateur,
      tuteur: { id: tuteur.id },
    });
  }

  /** Marque le code comme utilisé ; renvoie false s'il l'était déjà. */
  private async consommer(id: string): Promise<boolean> {
    const { count } = await this.prisma.codeOtp.updateMany({
      where: { id, consommeLe: null },
      data: { consommeLe: new Date() },
    });
    return count === 1;
  }

  /** Contact_tuteur_1 d'abord ; Contact_tuteur_2 seulement s'il désigne un seul tuteur. */
  async trouverTuteur(telephone: string) {
    const parContact1 = await this.prisma.tuteur.findFirst({
      where: { contact1: telephone },
      include: { utilisateur: true },
    });
    if (parContact1) return parContact1;

    const parContact2 = await this.prisma.tuteur.findMany({
      where: { contact2: telephone },
      include: { utilisateur: true },
      take: 2,
    });
    return parContact2.length === 1 ? parContact2[0] : null;
  }
}
