import { relayerFichier } from '@/lib/telechargement';

/** Bulletin PDF d'un élève pour une période (provisoire tant qu'il n'est pas publié). */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/bulletin/[eleveId]/[periodeId]'>,
) {
  const { eleveId, periodeId } = await ctx.params;
  return relayerFichier(
    `/resultats/eleves/${encodeURIComponent(eleveId)}/bulletins/${encodeURIComponent(periodeId)}`,
  );
}
