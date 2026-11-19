// Pays des écoles pour la saisie des numéros (même table que api/src/common/pays.ts).
import { LIBELLES_PAYS, type Pays } from './types';

export const TELEPHONE_PAYS: Record<
  Pays,
  { indicatif: string; chiffres: number; exemple: string }
> = {
  GN: { indicatif: '224', chiffres: 9, exemple: '621 12 34 56' },
  CI: { indicatif: '225', chiffres: 10, exemple: '07 12 34 56 78' },
  SN: { indicatif: '221', chiffres: 9, exemple: '77 123 45 67' },
};

export const LISTE_PAYS = (Object.keys(LIBELLES_PAYS) as Pays[]).map((p) => ({
  code: p,
  libelle: `${LIBELLES_PAYS[p]} (+${TELEPHONE_PAYS[p].indicatif})`,
}));

export const estPays = (v: unknown): v is Pays =>
  typeof v === 'string' && v in TELEPHONE_PAYS;

/** Pays proposé à la connexion : PAYS_PAR_DEFAUT (GN, CI ou SN), sinon la Guinée. */
export const paysParDefaut = (): Pays =>
  estPays(process.env.PAYS_PAR_DEFAUT) ? process.env.PAYS_PAR_DEFAUT : 'GN';

/**
 * Numéro en cours de saisie, présenté comme l'exemple du pays (« 77 123 45 67 »)
 * et limité à son nombre de chiffres. Une saisie internationale (+…, 00…, ou
 * l'indicatif du pays tapé sans « + ») reste libre : le numéro peut être d'un autre pays.
 * Même règle que mobile/src/lib/format.ts (testée là-bas).
 */
export function formaterTelephone(saisie: string, pays: Pays): string {
  const { indicatif, chiffres, exemple } = TELEPHONE_PAYS[pays];
  const debut = saisie.trimStart();
  const nombres = saisie.replace(/\D/g, '');
  if (/^(\+|00)/.test(debut))
    return `+${nombres.replace(/^00/, '')}`.slice(0, 16);
  // Aucun numéro local ne commence par l'indicatif (2…) : c'est un numéro international.
  if (nombres.length > indicatif.length && nombres.startsWith(indicatif))
    return `+${nombres}`.slice(0, 16);
  const tailles = exemple.split(' ').map((groupe) => groupe.length);
  const morceaux: string[] = [];
  let position = 0;
  for (const taille of tailles) {
    if (position >= Math.min(nombres.length, chiffres)) break;
    morceaux.push(
      nombres.slice(position, Math.min(position + taille, chiffres)),
    );
    position += taille;
  }
  return morceaux.join(' ');
}

/** Longueur maximale du champ : l'exemple du pays, ou un numéro international. */
export const longueurTelephone = (saisie: string, pays: Pays) =>
  saisie.startsWith('+') ? 16 : TELEPHONE_PAYS[pays].exemple.length;

/**
 * Numéro saisi par un parent → E.164, avec l'indicatif du pays choisi :
 * « 621 12 34 56 » (Guinée) → « +224621123456 ». Un numéro déjà international
 * (+… ou 00…) est gardé tel quel ; sinon la valeur nettoyée est rendue et l'API
 * la refusera avec un message.
 */
export function telephoneE164(saisie: string, pays: Pays): string {
  const { indicatif, chiffres } = TELEPHONE_PAYS[pays];
  let n = saisie.replace(/[\s.()-]/g, '');
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  if (n.startsWith('+')) return n;
  if (/^\d+$/.test(n)) {
    if (n.length === chiffres) return `+${indicatif}${n}`;
    if (n.length === indicatif.length + chiffres && n.startsWith(indicatif))
      return `+${n}`;
  }
  return n;
}
