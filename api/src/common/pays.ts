// Pays des écoles : monnaie et numéros de téléphone. Les trois pays sont à
// l'heure GMT toute l'année (même fuseau que Dakar) : les horaires ne changent pas.
import type { Pays } from '../generated/prisma/enums.js';

export interface ReglagesPays {
  nom: string;
  /** Monnaie des montants de l'école (entiers, sans centimes). */
  monnaie: 'GNF' | 'FCFA';
  /** Indicatif téléphonique, sans « + ». */
  indicatif: string;
  /** Nombre de chiffres d'un numéro national (sans l'indicatif). */
  chiffres: number;
  /** Exemple de numéro mobile tel qu'on l'écrit dans le pays. */
  exemple: string;
}

export const PAYS: Record<Pays, ReglagesPays> = {
  GN: {
    nom: 'Guinée',
    monnaie: 'GNF',
    indicatif: '224',
    chiffres: 9,
    exemple: '621 12 34 56',
  },
  CI: {
    nom: "Côte d'Ivoire",
    monnaie: 'FCFA',
    indicatif: '225',
    chiffres: 10,
    exemple: '07 12 34 56 78',
  },
  SN: {
    nom: 'Sénégal',
    monnaie: 'FCFA',
    indicatif: '221',
    chiffres: 9,
    exemple: '77 123 45 67',
  },
};

/** « +224621123456 » : l'exemple du pays au format international. */
export const exempleInternational = (pays: Pays) =>
  `+${PAYS[pays].indicatif}${PAYS[pays].exemple.replace(/\s/g, '')}`;
