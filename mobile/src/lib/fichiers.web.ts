import { API_URL, ErreurApi, jetonCourant } from './api';

/** Navigateur : télécharge le document avec le jeton puis l'ouvre dans un nouvel onglet. */
export async function ouvrirDocument(
  chemin: string,
  _nomFichier: string,
  _type = 'application/pdf',
): Promise<void> {
  // Onglet ouvert tout de suite : sinon le navigateur le bloque après l'attente.
  const onglet = window.open('', '_blank');
  const jeton = await jetonCourant();
  const reponse = await fetch(`${API_URL}${chemin}`, {
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
  }).catch(() => null);
  if (!reponse?.ok) {
    onglet?.close();
    throw new ErreurApi(0, 'Téléchargement impossible. Réessayez plus tard.');
  }
  const url = URL.createObjectURL(await reponse.blob());
  if (onglet) onglet.location.href = url;
  else window.location.assign(url);
}
