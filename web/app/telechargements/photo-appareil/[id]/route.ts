import { relayerFichier } from '@/lib/telechargement';

/** Photo d'un appareil : servie par l'API selon les droits de l'utilisateur connecté. */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/photo-appareil/[id]'>,
) {
  const { id } = await ctx.params;
  return relayerFichier(`/appareils/${encodeURIComponent(id)}/photo`);
}
