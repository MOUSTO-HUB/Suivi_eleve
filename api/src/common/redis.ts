import type { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';

/** Connexion Redis et préfixe communs à toutes les files BullMQ de l'API. */
export function optionsFile(config: ConfigService): {
  connection: ConnectionOptions;
  prefix: string;
} {
  return {
    connection: {
      url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      maxRetriesPerRequest: null,
    },
    prefix: config.get<string>('BULLMQ_PREFIXE', 'suivi'),
  };
}

/** Faux si les files sont traitées par un autre processus (NOTIFICATIONS_TRAITEMENT=non). */
export const traitementActif = (config: ConfigService) =>
  config.get<string>('NOTIFICATIONS_TRAITEMENT', 'oui') !== 'non';
