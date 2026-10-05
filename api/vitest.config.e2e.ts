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
    // Valeurs par défaut = docker-compose ; un .env ou l'environnement les remplace.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://suivi:suivi_dev@localhost:5432/suivi_eleve?schema=public',
      JWT_SECRET:
        process.env.JWT_SECRET ??
        'secret-e2e-uniquement-pour-les-tests-0123456789',
      // Les photos des tests ne vont pas dans le stockage de développement.
      STOCKAGE_DIR: join(tmpdir(), 'suivi-eleve-e2e-stockage'),
      SEUIL_USAGE_APPAREIL_MOIS: '3',
    },
  },
});
