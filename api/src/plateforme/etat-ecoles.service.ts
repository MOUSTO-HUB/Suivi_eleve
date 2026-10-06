import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { situationAbonnement } from './abonnements.regles.js';

export const MESSAGE_ECOLE_SUSPENDUE =
  "L'accès à Suivi_eleve est suspendu pour votre école (abonnement). La direction de l'école peut le rétablir en renouvelant l'abonnement.";

/** École suspendue (abonnement) : ni connexion, ni code SMS, ni envoi de message. */
@Injectable()
export class EtatEcolesService {
  constructor(private readonly prisma: PrismaService) {}

  async estSuspendue(ecoleId: string): Promise<boolean> {
    const ecole = await this.prisma.ecole.findUnique({
      where: { id: ecoleId },
      select: { finAbonnement: true, suspendueLe: true },
    });
    if (!ecole) return false;
    return situationAbonnement({ ...ecole, aPaye: true }).etat === 'SUSPENDUE';
  }
}
