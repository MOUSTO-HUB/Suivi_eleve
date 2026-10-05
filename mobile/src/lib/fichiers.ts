import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, ErreurApi, jetonCourant } from './api';

/**
 * Télécharge un document de l'API (bulletin, pièce jointe) puis propose de
 * l'ouvrir avec une application du téléphone (lecteur PDF, galerie…).
 */
export async function ouvrirDocument(
  chemin: string,
  nomFichier: string,
  type = 'application/pdf',
): Promise<void> {
  const jeton = await jetonCourant();
  const dossier = new Directory(Paths.cache, 'documents');
  if (!dossier.exists) dossier.create();
  const fichier = new File(dossier, nomFichier);
  if (fichier.exists) fichier.delete();
  let telecharge: File;
  try {
    telecharge = await File.downloadFileAsync(`${API_URL}${chemin}`, fichier, {
      headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    });
  } catch {
    throw new ErreurApi(0, 'Téléchargement impossible. Réessayez plus tard.');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new ErreurApi(0, 'Ce téléphone ne peut pas ouvrir le document.');
  }
  await Sharing.shareAsync(telecharge.uri, {
    mimeType: type,
    dialogTitle: nomFichier,
  });
}
