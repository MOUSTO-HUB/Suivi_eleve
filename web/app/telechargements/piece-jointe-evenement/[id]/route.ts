import { relayerFichier } from '@/lib/telechargement';

/** Pièce jointe d'un événement (PDF ou image), selon les droits de l'utilisateur connecté. */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/piece-jointe-evenement/[id]'>,
) {
  const { id } = await ctx.params;
  return relayerFichier(`/evenements/${encodeURIComponent(id)}/piece-jointe`);
}
