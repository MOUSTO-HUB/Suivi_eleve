import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';

export const REGEX_TELEPHONE = /^\+[1-9]\d{7,14}$/;

/** Accepte « +221 77 123 45 67 » et le ramène à « +221771234567 » (E.164). */
export const normaliserTelephone = (valeur: string): string =>
  valeur.replace(/[\s.()-]/g, '');

/**
 * Convertit un numéro saisi librement (fichier d'import) en E.164 :
 * « 77 123 45 67 » → « +221771234567 », « 00221… » → « +221… ».
 * Renvoie la valeur nettoyée telle quelle si elle ne peut pas être convertie.
 */
export function versE164(valeur: string, indicatif = '221'): string {
  let numero = normaliserTelephone(valeur);
  if (numero.startsWith('00')) numero = `+${numero.slice(2)}`;
  if (/^\d+$/.test(numero)) {
    numero = numero.startsWith(indicatif)
      ? `+${numero}`
      : `+${indicatif}${numero}`;
  }
  return numero;
}

/** Champ téléphone au format international, espaces tolérés à la saisie. */
export const EstTelephone = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normaliserTelephone(value) : value,
    ),
    Matches(REGEX_TELEPHONE, {
      message:
        'Le numéro doit être au format international, par exemple +221771234567.',
    }),
  );

/** Supprime les espaces en début et fin ; une chaîne vide devient undefined. */
export const Nettoyer = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const nettoye = value.trim();
    return nettoye === '' ? undefined : nettoye;
  });

/** Email en minuscules, sans espaces. */
export const EstEmail = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail({}, { message: "L'adresse email n'est pas valide." }),
  );
