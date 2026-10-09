import {
  HttpException,
  HttpStatus,
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export interface Limite {
  /** Nom de la limite (ex. connexion-ip). */
  nom: string;
  max: number;
  fenetreS: number;
  message: string;
}

/** Limites des routes d'authentification (EF sécurité : force brute, coût des SMS). */
export const LIMITES = {
  connexionIp: {
    nom: 'connexion-ip',
    max: 20,
    fenetreS: 15 * 60,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  },
  connexionEmail: {
    nom: 'connexion-email',
    max: 10,
    fenetreS: 15 * 60,
    message: 'Trop de tentatives pour ce compte. Réessayez dans 15 minutes.',
  },
  otpDemandeIp: {
    nom: 'otp-demande-ip',
    max: 10,
    fenetreS: 60 * 60,
    message: 'Trop de demandes de code. Réessayez dans une heure.',
  },
  otpVerificationIp: {
    nom: 'otp-verification-ip',
    max: 20,
    fenetreS: 15 * 60,
    message: 'Trop de codes essayés. Réessayez dans 15 minutes.',
  },
  doubleAuthIp: {
    nom: 'double-auth-ip',
    max: 20,
    fenetreS: 15 * 60,
    message: 'Trop de codes essayés. Réessayez dans 15 minutes.',
  },
  oubliIp: {
    nom: 'oubli-ip',
    max: 10,
    fenetreS: 60 * 60,
    message: 'Trop de demandes. Réessayez dans une heure.',
  },
  reinitialisationIp: {
    nom: 'reinitialisation-ip',
    max: 20,
    fenetreS: 15 * 60,
    message: 'Trop d’essais. Réessayez dans 15 minutes.',
  },
} satisfies Record<string, Limite>;

/**
 * Compteurs à fenêtre fixe dans Redis : partagés entre les instances de l'API
 * et conservés à son redémarrage.
 */
@Injectable()
export class LimiteurService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly prefixe: string;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { lazyConnect: true, maxRetriesPerRequest: 2 },
    );
    this.prefixe = config.get<string>('BULLMQ_PREFIXE', 'suivi');
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  /** Vrai la première fois que `cle` est vue pendant `dureeS` secondes (usage unique). */
  async premiereFois(cle: string, dureeS: number): Promise<boolean> {
    const reponse = await this.redis.set(
      `${this.prefixe}:unique:${cle}`,
      '1',
      'EX',
      Math.max(1, dureeS),
      'NX',
    );
    return reponse === 'OK';
  }

  /** Compte un essai ; au-delà du maximum, répond 429 avec le délai d'attente. */
  async verifier(limite: Limite, identifiant: string): Promise<void> {
    const cle = `${this.prefixe}:limite:${limite.nom}:${identifiant.toLowerCase()}`;
    const [[, compte], [, ttl]] = (await this.redis
      .multi()
      .incr(cle)
      .ttl(cle)
      .exec()) as [[null, number], [null, number]];
    if (ttl < 0) await this.redis.expire(cle, limite.fenetreS);
    if (compte > limite.max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: limite.message,
          reessayerDansS: ttl > 0 ? ttl : limite.fenetreS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
