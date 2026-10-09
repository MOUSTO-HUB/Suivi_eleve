import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { creerDefi, verifierSolution, type Defi } from './altcha.js';
import { LimiteurService } from './limiteur.service.js';

export const MESSAGE_ROBOT =
  'Cochez la case « Je ne suis pas un robot » puis réessayez.';

/**
 * Défis « Je ne suis pas un robot » (connexion, demande de code SMS, mot de passe
 * oublié). Chaque réponse ne sert qu'une fois (mémorisée dans Redis).
 */
@Injectable()
export class AltchaService {
  private readonly cle: string;
  private readonly difficulte: number;

  constructor(
    config: ConfigService,
    private readonly limiteur: LimiteurService,
  ) {
    // Clé propre à ALTCHA, distincte de celle des jetons de session.
    this.cle = `altcha:${config.getOrThrow<string>('JWT_SECRET')}`;
    const difficulte = Number(config.get('ALTCHA_DIFFICULTE'));
    this.difficulte =
      Number.isInteger(difficulte) && difficulte > 0 ? difficulte : 50_000;
  }

  defi(): Defi {
    return creerDefi(this.cle, this.difficulte);
  }

  async verifier(charge: string | undefined): Promise<void> {
    const solution = charge ? verifierSolution(charge, this.cle) : null;
    const dureeS = solution
      ? Math.ceil((solution.expireLe - Date.now()) / 1000)
      : 0;
    if (
      !solution ||
      !(await this.limiteur.premiereFois(
        `altcha:${solution.signature}`,
        dureeS,
      ))
    )
      throw new BadRequestException(MESSAGE_ROBOT);
  }
}
