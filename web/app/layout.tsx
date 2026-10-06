import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import {
  EnregistrementServiceWorker,
  InvitationInstallation,
} from '@/components/installation';
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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#047857' },
    { media: '(prefers-color-scheme: dark)', color: '#064e3b' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <EnregistrementServiceWorker />
        <InvitationInstallation />
        {children}
      </body>
    </html>
  );
}
