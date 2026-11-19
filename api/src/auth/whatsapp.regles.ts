// Connexion des parents par WhatsApp (« code inversé ») : règles sans dépendance,
// testées dans whatsapp.regles.spec.ts.
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export const DUREE_VALIDITE_WHATSAPP_MS = 10 * 60 * 1000;

/** Sans caractères faciles à confondre (0/O, 1/I/L). */
const LETTRES = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const CHIFFRES = '23456789';
const ALPHABET = LETTRES + CHIFFRES;

/** Code de 6 caractères, avec au moins une lettre et un chiffre (ex. K7M2PQ). */
export function nouveauCodeWhatsapp(): string {
  for (;;) {
    const code = Array.from(
      { length: 6 },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
    if (/\d/.test(code) && /[A-Z]/.test(code)) return code;
  }
}

/** Jeton de suivi gardé par l'appareil qui demande la connexion. */
export const nouveauJetonSuivi = () => randomBytes(32).toString('base64url');

export const empreinte = (valeur: string) =>
  createHash('sha256').update(valeur).digest('hex');

/** Message prérempli : le parent n'a qu'à l'envoyer. */
export const messageConnexion = (code: string) =>
  `Connexion Suivi_eleve : ${code}`;

/** Lien qui ouvre WhatsApp (application ou site) avec le message prérempli. */
export function lienWhatsapp(numeroService: string, texte: string): string {
  const numero = numeroService.replace(/\D/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}

/**
 * Code trouvé dans un message reçu : le dernier mot de 6 caractères qui contient
 * un chiffre (insensible à la casse, le reste du texte peut avoir été modifié).
 */
export function extraireCode(texte: string): string | null {
  const mots = texte.toUpperCase().match(/\b[A-Z0-9]{6}\b/g) ?? [];
  return mots.filter((m) => /\d/.test(m) && /[A-Z]/.test(m)).at(-1) ?? null;
}

/** Numéro de l'expéditeur au format E.164 (Meta l'envoie sans « + »). */
export function telephoneExpediteur(de: unknown): string | null {
  return typeof de === 'string' && /^\d{8,15}$/.test(de) ? `+${de}` : null;
}

/** Signature X-Hub-Signature-256 de Meta : HMAC-SHA256 du corps brut avec le secret de l'application. */
export function signatureValide(
  corpsBrut: Buffer | undefined,
  entete: string | undefined,
  secret: string,
): boolean {
  if (!corpsBrut || !entete?.startsWith('sha256=')) return false;
  const attendu = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(corpsBrut).digest('hex')}`,
  );
  const recu = Buffer.from(entete);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

export interface MessageRecu {
  telephone: string;
  texte: string;
}

/** Messages texte d'une notification de webhook WhatsApp (les accusés de lecture sont ignorés). */
export function messagesRecus(corps: unknown): MessageRecu[] {
  const entrees = (corps as { entry?: unknown })?.entry;
  if (!Array.isArray(entrees)) return [];
  const messages: MessageRecu[] = [];
  for (const entree of entrees as { changes?: unknown }[]) {
    if (!Array.isArray(entree?.changes)) continue;
    for (const changement of entree.changes as { value?: unknown }[]) {
      const liste = (changement?.value as { messages?: unknown })?.messages;
      if (!Array.isArray(liste)) continue;
      for (const m of liste as {
        from?: unknown;
        type?: unknown;
        text?: { body?: unknown };
      }[]) {
        const telephone = telephoneExpediteur(m?.from);
        const texte = m?.type === 'text' ? m.text?.body : undefined;
        if (telephone && typeof texte === 'string')
          messages.push({ telephone, texte });
      }
    }
  }
  return messages;
}
