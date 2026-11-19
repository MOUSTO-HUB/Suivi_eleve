import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import {
  EnregistrementServiceWorker,
  InvitationInstallation,
} from '@/components/installation';
import { COULEUR_BARRE } from '@/lib/theme';
import { themeCourant } from '@/lib/theme-serveur';
import './globals.css';

// Polices embarquées (sous-ensemble latin de Google Fonts) : aucun
// téléchargement au build, même avec une connexion instable.
const geistSans = localFont({
  src: './fonts/geist-latin.woff2',
  weight: '100 900',
  variable: '--font-geist-sans',
});

const geistMono = localFont({
  src: './fonts/geist-mono-latin.woff2',
  weight: '100 900',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Suivi_eleve',
  description: 'Suivi des élèves pour les parents',
  applicationName: 'Suivi_eleve',
  // Ouverture plein écran depuis l'écran d'accueil de l'iPhone.
  appleWebApp: {
    capable: true,
    title: 'Suivi_eleve',
    statusBarStyle: 'default',
  },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await themeCourant();
  return {
    themeColor: COULEUR_BARRE[theme],
    colorScheme: theme === 'sombre' ? 'dark' : 'light',
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      data-theme={await themeCourant()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <EnregistrementServiceWorker />
        <InvitationInstallation />
        {children}
      </body>
    </html>
  );
}
