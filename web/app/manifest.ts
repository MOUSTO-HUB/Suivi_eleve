import type { MetadataRoute } from 'next';

/** Manifeste de l'application installable (PC, Android, iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Suivi_eleve',
    short_name: 'Suivi_eleve',
    description: 'La scolarité de votre enfant, informée en temps réel.',
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f4f7fc',
    theme_color: '#1e3a8a',
    categories: ['education'],
    icons: [
      {
        src: '/icones/icone-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icones/icone-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icones/icone-masquable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
