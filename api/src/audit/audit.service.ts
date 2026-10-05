import { Injectable } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ActionAudit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Journal d'audit des modifications sensibles (cahier des charges, section 4). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async journaliser(
    utilisateur: UtilisateurConnecte,
    action: ActionAudit,
    entite: string,
    entiteId?: string,
    details?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.journalAudit.create({
      data: {
        ecoleId: utilisateur.ecoleId,
        utilisateurId: utilisateur.id,
        action,
        entite,
        entiteId,
        details,
      },
    });
  }
}
