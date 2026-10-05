import type { NextRequest } from 'next/server';
import { relayerFichier } from '@/lib/telechargement';

/** Export de la liste des élèves (mêmes filtres que la page, format csv ou xlsx). */
export function GET(request: NextRequest) {
  return relayerFichier(
    `/eleves/export?${request.nextUrl.searchParams.toString()}`,
  );
}
