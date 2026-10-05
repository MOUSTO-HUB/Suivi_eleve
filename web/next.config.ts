import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Le .env commun est à la racine du monorepo (Next ne lit que web/.env par défaut).
const envRacine = resolve(process.cwd(), '../.env');
if (existsSync(envRacine)) process.loadEnvFile(envRacine);

const nextConfig: NextConfig = {
  experimental: {
    // Pièces jointes des événements (5 Mo) et photos d'appareils (3 Mo), plus l'enveloppe multipart.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default nextConfig;
