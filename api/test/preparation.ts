import { randomUUID } from 'node:crypto';

// Chaque fichier de test a ses propres files BullMQ et compteurs de limite dans
// Redis : rien ne déborde d'un fichier ou d'une exécution à l'autre.
process.env.BULLMQ_PREFIXE ??= `e2e-${randomUUID()}`;
