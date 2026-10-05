import { relayerFichier } from '@/lib/telechargement';

/** Modèle Excel à remplir pour l'import d'élèves. */
export function GET() {
  return relayerFichier('/eleves/import/modele');
}
