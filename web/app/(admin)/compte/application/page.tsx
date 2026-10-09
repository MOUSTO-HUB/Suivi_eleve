import type { Metadata } from 'next';
import { AjoutApplication } from '@/components/ajout-application';

export const metadata: Metadata = {
  title: 'Application d’authentification · Suivi_eleve',
};

export default function Application() {
  return <AjoutApplication retour="/compte" />;
}
