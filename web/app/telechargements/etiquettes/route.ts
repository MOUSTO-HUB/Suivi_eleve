import type { NextRequest } from 'next/server';
import { relayerFichier } from '@/lib/telechargement';

/** Planche PDF d'étiquettes QR, pour un élève (eleveId) ou une classe (classeId). */
export function GET(request: NextRequest) {
  return relayerFichier(
    `/appareils/etiquettes?${request.nextUrl.searchParams.toString()}`,
  );
}
