import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // Valeur par défaut = base du docker-compose ; un .env la remplace.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://suivi:suivi_dev@localhost:5432/suivi_eleve?schema=public',
    },
  },
});
