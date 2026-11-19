// Lectures côté serveur pour la page de connexion (pas des Server Actions).
import { cookies } from 'next/headers';
import { API_URL } from '@/lib/session';

/** Moyens de connexion des parents proposés par l'API (les SMS peuvent être coupés). */
export interface CanauxParents {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
}

export async function canauxParents(): Promise<CanauxParents> {
  try {
    const reponse = await fetch(`${API_URL}/auth/parents/canaux`, {
      cache: 'no-store',
    });
    if (reponse.ok) return (await reponse.json()) as CanauxParents;
  } catch {
    // API injoignable : le formulaire affichera l'erreur à l'envoi.
  }
  return { sms: true, email: true, whatsapp: false };
}

/** Demande de connexion WhatsApp en cours, gardée côté serveur (cookie httpOnly, 10 minutes). */
export const COOKIE_WHATSAPP = 'suivi_whatsapp';

export interface AttenteWhatsapp {
  jeton: string;
  code: string;
  lien: string;
  numero: string;
  telephone: string;
}

export async function attenteWhatsapp(): Promise<AttenteWhatsapp | null> {
  const valeur = (await cookies()).get(COOKIE_WHATSAPP)?.value;
  if (!valeur) return null;
  try {
    return JSON.parse(valeur) as AttenteWhatsapp;
  } catch {
    return null;
  }
}
