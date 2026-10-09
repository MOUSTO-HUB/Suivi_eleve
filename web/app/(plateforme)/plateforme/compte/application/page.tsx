import type { Metadata } from 'next';
import { AjoutApplication } from '@/components/ajout-application';

export const metadata: Metadata = {
  title: 'Application d’authentification · Concepteur · Suivi_eleve',
};

export default function ApplicationConcepteur() {
  return <AjoutApplication retour="/plateforme/compte" />;
}
