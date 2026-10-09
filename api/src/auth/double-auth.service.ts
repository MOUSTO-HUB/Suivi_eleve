import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { createHash, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service.js';
import {
  ActionAudit,
  ButCodeVerification,
  MethodeDoubleAuth,
  type Role,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { chiffrer, dechiffrer } from '../securite/chiffrement.js';
import { EmailSender } from '../sms/email.sender.js';
import type { UtilisateurConnecte } from './auth.types.js';
import {
  doubleAuthObligatoire,
  emailMasque,
  methodeDoubleAuth,
  SANS_DOUBLE_AUTH,
} from './connexion.regles.js';
import {
  empreinteCodeSecours,
  estFormeCodeSecours,
  lienTotp,
  nouveauSecretTotp,
  nouveauxCodesSecours,
  verifierTotp,
} from './totp.js';

export const DUREE_CODE_EMAIL_MS = 10 * 60 * 1000;
export const ESSAIS_MAX_CODE_EMAIL = 3;
const CODES_EMAIL_MAX = 3;
const FENETRE_CODES_EMAIL_MS = 15 * 60 * 1000;

/** Étape 2 de la connexion : le mot de passe est bon, il reste le code. */
export interface DefiDoubleAuth {
  doubleAuth: {
    /** Jeton signé (10 minutes) à renvoyer avec le code. */
    jeton: string;
    methode: MethodeDoubleAuth;
    /** Adresse masquée où le code a été envoyé (méthode EMAIL). */
    email?: string;
  };
}

interface CompteDoubleAuth {
  id: string;
  role: Role;
  email: string | null;
  doubleAuth: MethodeDoubleAuth | null;
  totpSecret: string | null;
  totpDernierPas: number | null;
}

const empreinte = (texte: string) =>
  createHash('sha256').update(texte).digest('hex');
/** Lié au compte : le même code de deux comptes ne donne pas la même empreinte. */
const empreinteCode = (utilisateurId: string, code: string) =>
  empreinte(`${utilisateurId}:${code}`);

/**
 * Double authentification du personnel : code d'une application (TOTP) ou code
 * envoyé par email, plus des codes de secours. Obligatoire pour la direction,
 * la comptabilité et le concepteur (email par défaut), proposée aux autres.
 */
@Injectable()
export class DoubleAuthService {
  private readonly secretDefi: string;
  private readonly secretPreparation: string;
  private readonly secretChiffrement: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly email: EmailSender,
    config: ConfigService,
  ) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    // Clés distinctes : un jeton d'étape ne peut jamais servir de jeton d'accès.
    this.secretDefi = `${secret}:double-auth`;
    this.secretPreparation = `${secret}:double-auth-preparation`;
    this.secretChiffrement = secret;
  }

  // ─── Connexion ──────────────────────────────────────────────────────────────

  async defi(
    compte: CompteDoubleAuth,
    methode: MethodeDoubleAuth,
  ): Promise<DefiDoubleAuth> {
    if (methode === MethodeDoubleAuth.EMAIL) await this.envoyerCode(compte);
    const jeton = await this.jwt.signAsync(
      { sub: compte.id },
      { secret: this.secretDefi, expiresIn: '10m' },
    );
    return {
      doubleAuth: {
        jeton,
        methode,
        ...(methode === MethodeDoubleAuth.EMAIL && compte.email
          ? { email: emailMasque(compte.email) }
          : {}),
      },
    };
  }

  /** Identifiant du compte porté par le jeton d'étape. */
  async lireDefi(jeton: string): Promise<string> {
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(jeton, {
        secret: this.secretDefi,
      });
      return sub;
    } catch {
      throw new UnauthorizedException(
        'Étape expirée : saisissez à nouveau votre email et votre mot de passe.',
      );
    }
  }

  /**
   * Nouveau code par email ; les précédents sont annulés. Au plus 3 codes non
   * utilisés par quart d'heure (un code utilisé est effacé et ne compte pas).
   */
  async envoyerCode(compte: CompteDoubleAuth): Promise<void> {
    if (!compte.email)
      throw new BadRequestException('Aucune adresse email sur ce compte.');
    const recents = await this.prisma.codeVerification.count({
      where: {
        utilisateurId: compte.id,
        but: ButCodeVerification.DOUBLE_AUTH,
        creeLe: { gte: new Date(Date.now() - FENETRE_CODES_EMAIL_MS) },
      },
    });
    if (recents >= CODES_EMAIL_MAX)
      throw new HttpException(
        'Trop de codes demandés. Réessayez dans 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      this.prisma.codeVerification.updateMany({
        where: {
          utilisateurId: compte.id,
          but: ButCodeVerification.DOUBLE_AUTH,
          consommeLe: null,
        },
        data: { consommeLe: new Date() },
      }),
      this.prisma.codeVerification.create({
        data: {
          utilisateurId: compte.id,
          but: ButCodeVerification.DOUBLE_AUTH,
          codeHash: empreinteCode(compte.id, code),
          expireLe: new Date(Date.now() + DUREE_CODE_EMAIL_MS),
        },
      }),
    ]);
    await this.email.envoyer(
      compte.email,
      `Code de connexion : ${code}`,
      `Suivi_eleve : votre code de connexion est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne. Si vous n'essayez pas de vous connecter, changez votre mot de passe.`,
    );
  }

  /** Code de l'application, code reçu par email ou code de secours (consommé). */
  async codeValide(compte: CompteDoubleAuth, saisie: string): Promise<boolean> {
    const code = saisie.trim();
    const methode = methodeDoubleAuth(compte);
    if (/^\d{6}$/.test(code)) {
      if (methode === MethodeDoubleAuth.APPLICATION && compte.totpSecret) {
        const pas = verifierTotp(
          dechiffrer(compte.totpSecret, this.secretChiffrement),
          code,
          compte.totpDernierPas,
        );
        if (pas === null) return false;
        // Un code d'application ne sert qu'une fois, même envoyé deux fois en même temps.
        const { count } = await this.prisma.utilisateur.updateMany({
          where: {
            id: compte.id,
            OR: [{ totpDernierPas: null }, { totpDernierPas: { lt: pas } }],
          },
          data: { totpDernierPas: pas },
        });
        return count === 1;
      }
      if (methode === MethodeDoubleAuth.EMAIL)
        return this.codeEmailValide(compte.id, code);
      return false;
    }
    if (estFormeCodeSecours(code)) {
      const e = empreinteCodeSecours(code);
      const { codesSecours } = await this.prisma.utilisateur.findUniqueOrThrow({
        where: { id: compte.id },
        select: { codesSecours: true },
      });
      if (!codesSecours.includes(e)) return false;
      const { count } = await this.prisma.utilisateur.updateMany({
        where: { id: compte.id, codesSecours: { has: e } },
        data: { codesSecours: codesSecours.filter((c) => c !== e) },
      });
      return count === 1;
    }
    return false;
  }

  private async codeEmailValide(id: string, code: string): Promise<boolean> {
    const dernier = await this.prisma.codeVerification.findFirst({
      where: {
        utilisateurId: id,
        but: ButCodeVerification.DOUBLE_AUTH,
        consommeLe: null,
      },
      orderBy: { creeLe: 'desc' },
    });
    if (!dernier || dernier.expireLe < new Date()) return false;
    const { count } = await this.prisma.codeVerification.updateMany({
      where: {
        id: dernier.id,
        consommeLe: null,
        essais: { lt: ESSAIS_MAX_CODE_EMAIL },
      },
      data: { essais: { increment: 1 } },
    });
    if (count === 0 || dernier.codeHash !== empreinteCode(id, code))
      return false;
    // Code utilisé : effacé, il ne compte plus dans la limite des codes demandés.
    const utilise = await this.prisma.codeVerification.deleteMany({
      where: { id: dernier.id, consommeLe: null },
    });
    return utilise.count === 1;
  }

  // ─── Réglages (« Mon compte ») ─────────────────────────────────────────────

  async etat(u: UtilisateurConnecte) {
    const compte = await this.compte(u.id);
    return {
      methode: methodeDoubleAuth(compte),
      obligatoire: doubleAuthObligatoire(compte.role),
      codesSecoursRestants: compte.codesSecours.length,
    };
  }

  /** Clé et QR code à scanner ; rien n'est enregistré avant la confirmation par un code. */
  async preparerApplication(u: UtilisateurConnecte) {
    const compte = await this.compte(u.id);
    const secret = nouveauSecretTotp();
    const lien = lienTotp(secret, compte.email ?? compte.id);
    const jeton = await this.jwt.signAsync(
      { sub: u.id, secret: chiffrer(secret, this.secretChiffrement) },
      { secret: this.secretPreparation, expiresIn: '15m' },
    );
    return {
      secret,
      lien,
      qrCode: await QRCode.toDataURL(lien, { margin: 1, width: 220 }),
      jeton,
    };
  }

  /** Active l'application après un premier code juste ; renvoie les codes de secours (une fois). */
  async activerApplication(
    u: UtilisateurConnecte,
    jeton: string,
    code: string,
    motDePasse: string,
  ) {
    await this.verifierMotDePasse(u.id, motDePasse);
    let secretChiffre: string;
    try {
      const charge = await this.jwt.verifyAsync<{
        sub: string;
        secret: string;
      }>(jeton, { secret: this.secretPreparation });
      if (charge.sub !== u.id) throw new Error();
      secretChiffre = charge.secret;
    } catch {
      throw new BadRequestException(
        'Préparation expirée : recommencez l’ajout de l’application.',
      );
    }
    const pas = verifierTotp(
      dechiffrer(secretChiffre, this.secretChiffrement),
      code.trim(),
    );
    if (pas === null)
      throw new BadRequestException(
        'Code incorrect. Vérifiez que l’heure du téléphone est juste et saisissez le code affiché maintenant.',
      );
    const codes = nouveauxCodesSecours();
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: {
        doubleAuth: MethodeDoubleAuth.APPLICATION,
        totpSecret: secretChiffre,
        totpDernierPas: pas,
        codesSecours: codes.map(empreinteCodeSecours),
      },
    });
    await this.journaliser(u, { doubleAuth: MethodeDoubleAuth.APPLICATION });
    return { codesSecours: codes };
  }

  /** Code par email à chaque connexion (l'application est retirée). */
  async choisirEmail(u: UtilisateurConnecte, motDePasse: string) {
    const compte = await this.verifierMotDePasse(u.id, motDePasse);
    if (!compte.email)
      throw new BadRequestException('Aucune adresse email sur ce compte.');
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: { ...SANS_DOUBLE_AUTH, doubleAuth: MethodeDoubleAuth.EMAIL },
    });
    await this.journaliser(u, { doubleAuth: MethodeDoubleAuth.EMAIL });
    return this.etat(u);
  }

  async desactiver(u: UtilisateurConnecte, motDePasse: string) {
    const compte = await this.verifierMotDePasse(u.id, motDePasse);
    if (doubleAuthObligatoire(compte.role))
      throw new BadRequestException(
        'La double authentification est obligatoire pour votre rôle.',
      );
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: SANS_DOUBLE_AUTH,
    });
    await this.journaliser(u, { doubleAuth: 'aucune' });
    return this.etat(u);
  }

  async nouveauxCodesSecours(u: UtilisateurConnecte, motDePasse: string) {
    const compte = await this.verifierMotDePasse(u.id, motDePasse);
    if (compte.doubleAuth !== MethodeDoubleAuth.APPLICATION)
      throw new BadRequestException(
        'Les codes de secours accompagnent l’application d’authentification.',
      );
    const codes = nouveauxCodesSecours();
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: { codesSecours: codes.map(empreinteCodeSecours) },
    });
    await this.journaliser(u, { codesSecoursRegeneres: true });
    return { codesSecours: codes };
  }

  private async compte(id: string) {
    return this.prisma.utilisateur.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        role: true,
        email: true,
        doubleAuth: true,
        motDePasseHash: true,
        codesSecours: true,
      },
    });
  }

  /** Toute modification demande le mot de passe (session restée ouverte sur un poste partagé). */
  private async verifierMotDePasse(id: string, motDePasse: string) {
    const compte = await this.compte(id);
    if (
      !compte.motDePasseHash ||
      !(await verify(compte.motDePasseHash, motDePasse))
    )
      throw new BadRequestException('Mot de passe incorrect.');
    return compte;
  }

  private journaliser(
    u: UtilisateurConnecte,
    details: Record<string, string | boolean>,
  ) {
    return this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      u.id,
      details,
    );
  }
}
