// Règles des comportements marquants (EF-50 à EF-52), sans accès à la base.
import { heureFr, jourFr } from '../annonces/annonces.regles.js';
import {
  CategorieComportement,
  Role,
  StatutValidation,
  TypeComportement,
} from '../generated/prisma/enums.js';

const C = CategorieComportement;

export const CATEGORIES: Record<TypeComportement, CategorieComportement[]> = {
  POSITIF: [C.FELICITATIONS, C.ENCOURAGEMENT],
  NEGATIF: [
    C.RETARD,
    C.ABSENCE,
    C.INDISCIPLINE,
    C.FRAUDE,
    C.VIOLENCE,
    C.USAGE_APPAREIL,
    C.AUTRE,
  ],
};

export const LIBELLES_CATEGORIE: Record<CategorieComportement, string> = {
  FELICITATIONS: 'félicitations',
  ENCOURAGEMENT: 'encouragements',
  RETARD: 'retards répétés',
  ABSENCE: 'absence',
  INDISCIPLINE: 'indiscipline',
  FRAUDE: 'fraude',
  VIOLENCE: 'violence',
  USAGE_APPAREIL: "usage d'un appareil en classe",
  AUTRE: 'comportement à signaler',
};

/** Gravité qui exige la validation de la direction avant tout message aux familles. */
export const GRAVITE_VALIDATION = 3;

/** Message d'erreur si la saisie est incohérente, sinon null. */
export function erreurComportement(c: {
  type: TypeComportement;
  categorie: CategorieComportement;
  gravite?: number;
}): string | null {
  if (!CATEGORIES[c.type].includes(c.categorie)) {
    return `La catégorie « ${LIBELLES_CATEGORIE[c.categorie]} » ne correspond pas à un comportement ${
      c.type === TypeComportement.POSITIF ? 'positif' : 'négatif'
    }.`;
  }
  if (c.type === TypeComportement.NEGATIF && !c.gravite) {
    return 'Indiquez la gravité (1 à 3).';
  }
  return null;
}

/**
 * Un cas grave signalé par un enseignant ou la vie scolaire attend la direction
 * (EF-51) ; signalé par la direction elle-même, il est validé d'emblée.
 */
export function statutInitial(
  type: TypeComportement,
  gravite: number,
  role: Role,
): StatutValidation {
  return type === TypeComportement.NEGATIF &&
    gravite >= GRAVITE_VALIDATION &&
    role !== Role.ADMIN
    ? StatutValidation.EN_ATTENTE
    : StatutValidation.VALIDE;
}

const avecPoint = (texte: string) =>
  /[.!?…]$/.test(texte) ? texte : `${texte}.`;

/** Textes envoyés aux familles : un résumé pour le SMS et le push, le détail pour l'email. */
export function messagesComportement(
  prenom: string,
  c: {
    type: TypeComportement;
    categorie: CategorieComportement;
    description: string;
    sanction: string | null;
    convocationLe: Date | null;
    date: Date;
  },
): { resume: string; details: string } {
  const quoi = LIBELLES_CATEGORIE[c.categorie];
  const le = jourFr(c.date).slice(0, 5);
  const convocation = c.convocationLe
    ? `le ${jourFr(c.convocationLe)} à ${heureFr(c.convocationLe)}`
    : null;

  if (c.type === TypeComportement.POSITIF) {
    // Le résumé part par SMS : pas de « ç » ni de « ê », qui y perdraient leur accent.
    return {
      resume: `${quoi.charAt(0).toUpperCase()}${quoi.slice(1)} pour ${prenom} le ${le}. Détails dans l'application.`,
      details: [
        `Nous avons le plaisir de vous informer que ${prenom} a reçu des ${quoi} le ${jourFr(c.date)}.`,
        avecPoint(c.description),
      ].join('\n\n'),
    };
  }
  return {
    resume: [
      `${prenom} : ${quoi} le ${le}.`,
      convocation
        ? `Convocation des parents ${convocation}.`
        : "Détails dans l'application.",
    ].join(' '),
    details: [
      `Nous devons vous signaler un comportement de ${prenom} le ${jourFr(c.date)} : ${quoi}.`,
      avecPoint(c.description),
      c.sanction ? `Sanction : ${avecPoint(c.sanction)}` : null,
      convocation
        ? `Nous vous prions de vous présenter à l'école ${convocation} pour un entretien.`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}
