import { relayerFichier } from '@/lib/telechargement';

/** Export des données personnelles d'un élève (direction seulement, vérifié par l'API). */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/telechargements/donnees-eleve/[id]'>,
) {
  const { id } = await ctx.params;
  return relayerFichier(`/eleves/${encodeURIComponent(id)}/donnees`);
}
