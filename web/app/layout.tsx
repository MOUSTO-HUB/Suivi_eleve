import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import {
  EnregistrementServiceWorker,
  InvitationInstallation,
} from '@/components/installation';
import { COULEUR_BARRE } from '@/lib/theme';
import { themeCourant } from '@/lib/theme-serveur';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
