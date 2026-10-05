import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { ActionAudit, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreerUtilisateurDto,
  ModifierUtilisateurDto,
} from './utilisateurs.dto.js';
import {
  erreurMotDePasse,
  motDePasseProvisoire,
} from './utilisateurs.regles.js';

const selection = {
  id: true,
  prenoms: true,
  nom: true,
  email: true,
  role: true,
  actif: true,
  derniereConnexion: true,
  creeLe: true,
} satisfies Prisma.UtilisateurSelect;

/**
 * Comptes du personnel, gérés par la direction. Un mot de passe provisoire est
 * donné à la création et à la réinitialisation : il n'est affiché qu'une fois.
 */
@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  lister(u: UtilisateurConnecte) {
    return this.prisma.utilisateur.findMany({
      where: { ecoleId: u.ecoleId, role: { not: Role.PARENT } },
      select: selection,
      orderBy: [{ actif: 'desc' }, { nom: 'asc' }, { prenoms: 'asc' }],
    });
  }

  async creer(u: UtilisateurConnecte, dto: CreerUtilisateurDto) {
    const motDePasse = motDePasseProvisoire();
    try {
      const cree = await this.prisma.utilisateur.create({
        data: {
          ecoleId: u.ecoleId,
          prenoms: dto.prenoms,
          nom: dto.nom,
          email: dto.email,
          role: dto.role,
          motDePasseHash: await hash(motDePasse),
          creePar: u.id,
        },
        select: selection,
      });
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Utilisateur',
        cree.id,
        {
          role: dto.role,
        },
      );
      return { ...cree, motDePasseProvisoire: motDePasse };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('Un compte existe déjà avec cet email.');
      throw e;
    }
  }

  async modifier(
    u: UtilisateurConnecte,
    id: string,
    dto: ModifierUtilisateurDto,
  ) {
    const compte = await this.trouver(u, id);
    // La direction ne peut pas se retirer elle-même l'accès (aucun moyen de revenir).
    if (
      id === u.id &&
      (dto.actif === false || (dto.role && dto.role !== Role.ADMIN))
    )
      throw new BadRequestException(
        'Vous ne pouvez pas désactiver votre propre compte ni changer votre rôle.',
      );
    const modifie = await this.prisma.utilisateur.update({
      where: { id },
      data: dto,
      select: selection,
    });
    if (dto.actif === false && compte.actif) await this.fermerSessions(id);
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      id,
      {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    );
    return modifie;
  }

  /** Nouveau mot de passe provisoire ; les sessions ouvertes sont fermées. */
  async reinitialiser(u: UtilisateurConnecte, id: string) {
    await this.trouver(u, id);
    const motDePasse = motDePasseProvisoire();
    await this.prisma.utilisateur.update({
      where: { id },
      data: { motDePasseHash: await hash(motDePasse) },
    });
    await this.fermerSessions(id);
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      id,
      {
        motDePasseReinitialise: true,
      },
    );
    return { motDePasseProvisoire: motDePasse };
  }

  /** Chaque membre du personnel change son propre mot de passe. */
  async changerMotDePasse(
    u: UtilisateurConnecte,
    actuel: string,
    nouveau: string,
  ) {
    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: u.id },
    });
    if (
      !compte?.motDePasseHash ||
      !(await verify(compte.motDePasseHash, actuel))
    )
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    const erreur = erreurMotDePasse(nouveau);
    if (erreur) throw new BadRequestException(erreur);
    if (nouveau === actuel)
      throw new BadRequestException(
        "Choisissez un mot de passe différent de l'actuel.",
      );
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: { motDePasseHash: await hash(nouveau) },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      u.id,
      {
        motDePasseChange: true,
      },
    );
  }

  private async trouver(u: UtilisateurConnecte, id: string) {
    const compte = await this.prisma.utilisateur.findFirst({
      where: { id, ecoleId: u.ecoleId, role: { not: Role.PARENT } },
      select: { actif: true },
    });
    if (!compte) throw new NotFoundException('Compte introuvable.');
    return compte;
  }

  private fermerSessions(id: string) {
    return this.prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId: id, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }
}
