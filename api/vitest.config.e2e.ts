import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Les files BullMQ laissent quelques instants à la fermeture.
    hookTimeout: 30_000,
    // Les envois passent par la file (avec reprises) : laisser le temps.
    testTimeout: 30_000,
    // Valeurs par défaut = docker-compose ; un .env ou l'environnement les remplace.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://suivi:suivi_dev@localhost:5432/suivi_eleve?schema=public',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      JWT_SECRET:
        process.env.JWT_SECRET ??
        'secret-e2e-uniquement-pour-les-tests-0123456789',
      // Les photos des tests ne vont pas dans le stockage de développement.
      STOCKAGE_DIR: join(tmpdir(), 'suivi-eleve-e2e-stockage'),
      SEUIL_USAGE_APPAREIL_MOIS: '3',
      // Fournisseurs simulés : aucun vrai SMS ni email pendant les tests.
      SMS_FOURNISSEUR: 'simulation',
      SMS_FOURNISSEUR_SECOURS: 'simulation-secours',
      EMAIL_FOURNISSEUR: 'simulation',
      PUSH_FOURNISSEUR: 'simulation',
      NOTIFICATIONS_ESSAIS: '3',
      NOTIFICATIONS_DELAI_ESSAI_MS: '20',
      SMS_PLAFOND_MENSUEL: '0',
      WEBHOOK_SECRET: 'secret-webhook-e2e',
    },
  },
});
