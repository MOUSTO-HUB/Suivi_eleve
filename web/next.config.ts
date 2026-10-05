import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Le .env commun est à la racine du monorepo (Next ne lit que web/.env par défaut).
const envRacine = resolve(process.cwd(), '../.env');
if (existsSync(envRacine)) process.loadEnvFile(envRacine);

const PROD = process.env.NODE_ENV === 'production';

// Le navigateur ne parle qu'au site lui-même (l'API est appelée côté serveur).
// 'unsafe-inline' : scripts d'hydratation de Next ; 'unsafe-eval' : développement seulement.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${PROD ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // Image Docker légère : serveur autonome avec seulement les fichiers utiles.
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '..'),
  poweredByHeader: false,
  experimental: {
    // Pièces jointes des événements (5 Mo) et photos d'appareils (3 Mo), plus l'enveloppe multipart.
    serverActions: { bodySizeLimit: '6mb' },
  },
  headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          ...(PROD
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
