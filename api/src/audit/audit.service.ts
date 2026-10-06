import { Injectable } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ActionAudit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ipRequete } from '../securite/contexte-requete.js';

/** Journal d'audit des modifications sensibles (cahier des charges, section 4). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `ecoleId` : école concernée par une action du concepteur (qui n'a pas
   * d'école) ; sinon celle de l'utilisateur. Connexion du concepteur : aucune.
   */
  async journaliser(
    utilisateur: UtilisateurConnecte,
    action: ActionAudit,
    entite: string,
    entiteId?: string,
    details?: Prisma.InputJsonValue,
    ecoleId?: string,
  ): Promise<void> {
    await this.prisma.journalAudit.create({
      data: {
        ecoleId: ecoleId ?? (utilisateur.ecoleId || null),
        utilisateurId: utilisateur.id,
        action,
        entite,
        entiteId,
        details,
        ip: ipRequete(),
      },
    });
  }
}
