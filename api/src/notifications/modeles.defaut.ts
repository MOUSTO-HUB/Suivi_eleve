// Modèles de messages par défaut, en français. L'école peut les remplacer (table modeles_message).
// Variables toujours disponibles : {prenom_eleve}, {nom_eleve}, {classe}, {ecole}, {prenom_tuteur}.
import type { TypeNotification } from '../generated/prisma/enums.js';

export type CanalModele = 'SMS' | 'EMAIL' | 'PUSH';

export interface Modele {
  /** Objet de l'email, titre de la notification push ; ignoré pour un SMS. */
  sujet?: string;
  contenu: string;
}

export const CANAUX_MODELE: CanalModele[] = ['SMS', 'EMAIL', 'PUSH'];

const salutation = 'Bonjour {prenom_tuteur},\n\n';
const signature = '\n\n{ecole}';

export const MODELES_PAR_DEFAUT: Record<
  TypeNotification,
  Record<CanalModele, Modele>
> = {
  LIBERATION_ANTICIPEE: {
    SMS: {
      contenu:
        'Suivi_eleve : les élèves de {classe} sont libérés à {heure} ({motif}). Merci de prendre vos dispositions.',
    },
    EMAIL: {
      sujet: 'Libération anticipée – {classe}',
      contenu: `${salutation}Les élèves de {classe} sont libérés aujourd'hui à {heure} ({motif}). Merci de prendre vos dispositions pour {prenom_eleve}.{details}${signature}`,
    },
    PUSH: {
      sujet: 'Libération anticipée',
      contenu: '{classe} : sortie à {heure} ({motif}).',
    },
  },
  ABSENCE: {
    SMS: {
      contenu:
        "Suivi_eleve : {prenom_eleve} ({classe}) est absent(e) le {date} ({creneau}) sans justification. Merci de contacter l'école.",
    },
    EMAIL: {
      sujet: 'Absence de {prenom_eleve} le {date}',
      contenu: `${salutation}{prenom_eleve} ({classe}) a été noté(e) absent(e) le {date} ({creneau}{matiere}), sans justification connue de l'école.

Merci de nous indiquer le motif de cette absence, par l'application ou auprès de la vie scolaire.${signature}`,
    },
    PUSH: {
      sujet: 'Absence de {prenom_eleve}',
      contenu:
        'Absent(e) le {date} ({creneau}). Merci de justifier cette absence.',
    },
  },
  PAS_DE_COURS: {
    SMS: {
      contenu:
        'Suivi_eleve : pas de cours le {date} {creneau} pour {classe} ({motif}).',
    },
    EMAIL: {
      sujet: 'Pas de cours le {date} – {classe}',
      contenu: `${salutation}Il n'y aura pas cours le {date} {creneau} pour {classe} ({motif}).{details}${signature}`,
    },
    PUSH: {
      sujet: 'Pas de cours',
      contenu: '{classe} : pas de cours le {date} {creneau} ({motif}).',
    },
  },
  COMPORTEMENT: {
    // {resume} : une phrase courte pour le SMS et le push ; {details} : le compte rendu complet.
    SMS: { contenu: 'Suivi_eleve : {resume}' },
    EMAIL: {
      sujet: 'Comportement – {prenom_eleve}',
      contenu: `${salutation}{details}${signature}`,
    },
    PUSH: { sujet: 'Comportement de {prenom_eleve}', contenu: '{resume}' },
  },
  // Paiements : le comptable saisit {libelle}, {montant} et {date_echeance} ;
  // {monnaie} (GNF ou FCFA) vient du pays de l'école ;
  // {jours_retard} est calculé (« 12 jours ») ; {total} résume les autres sommes en attente.
  RAPPEL_PAIEMENT: {
    SMS: {
      contenu:
        'Suivi_eleve : rappel, {libelle} de {prenom_eleve} : {montant} {monnaie} à régler avant le {date_echeance}.',
    },
    // Tournures neutres : le libellé peut être singulier (mensualité) ou pluriel (frais).
    EMAIL: {
      sujet: 'Rappel de paiement : {libelle}',
      contenu: `${salutation}Pour rappel, le paiement suivant est attendu pour {prenom_eleve} avant le {date_echeance} : {libelle}, {montant} {monnaie}.{total}${signature}`,
    },
    PUSH: {
      sujet: 'Rappel de paiement',
      contenu:
        '{libelle} : {montant} {monnaie} à régler avant le {date_echeance}.',
    },
  },
  RETARD_PAIEMENT: {
    SMS: {
      contenu:
        'Suivi_eleve : {libelle} de {prenom_eleve} ({montant} {monnaie}) à régler depuis le {date_echeance} : {jours_retard} de retard. Merci de régulariser.',
    },
    EMAIL: {
      sujet: 'Retard de paiement : {libelle}',
      contenu: `${salutation}Sauf erreur de notre part, le paiement suivant était attendu pour {prenom_eleve} le {date_echeance} : {libelle}, {montant} {monnaie}. Le retard est aujourd'hui de {jours_retard}.{total}\n\nMerci de régulariser auprès de la comptabilité de l'école. Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.${signature}`,
    },
    PUSH: {
      sujet: 'Paiement en retard',
      contenu: '{libelle} : {montant} {monnaie}, {jours_retard} de retard.',
    },
  },
  RECU_PAIEMENT: {
    SMS: {
      contenu:
        'Suivi_eleve : paiement de {montant} {monnaie} reçu ({mois}). Reçu n° {numero_recu}.',
    },
    EMAIL: {
      sujet: 'Reçu de paiement n° {numero_recu}',
      contenu: `${salutation}Nous avons bien reçu votre paiement de {montant} {monnaie} pour {prenom_eleve} ({mois}). Reçu n° {numero_recu}.${signature}`,
    },
    PUSH: {
      sujet: 'Paiement reçu',
      contenu: '{montant} {monnaie} ({mois}), reçu n° {numero_recu}.',
    },
  },
  RESULTATS: {
    SMS: {
      contenu:
        "Suivi_eleve : résultats de {prenom_eleve} ({periode}) : moyenne {moyenne}/20, rang {rang}. Bulletin dans l'application.",
    },
    EMAIL: {
      sujet: 'Résultats de {prenom_eleve} – {periode}',
      contenu: `${salutation}Les résultats de {prenom_eleve} pour {periode} sont publiés : moyenne {moyenne}/20, rang {rang}.\n\nLe bulletin est disponible dans l'application.${signature}`,
    },
    PUSH: {
      sujet: 'Résultats publiés',
      contenu: '{prenom_eleve} : {moyenne}/20, rang {rang} ({periode}).',
    },
  },
  DECISION_FIN_ANNEE: {
    SMS: {
      contenu:
        "Suivi_eleve : décision de fin d'année pour {prenom_eleve} : {decision}.",
    },
    EMAIL: {
      sujet: "Décision de fin d'année – {prenom_eleve}",
      contenu: `${salutation}La décision de fin d'année {annee} pour {prenom_eleve} est : {decision}.${signature}`,
    },
    PUSH: {
      sujet: "Décision de fin d'année",
      contenu: '{prenom_eleve} : {decision}.',
    },
  },
  EVENEMENT: {
    SMS: {
      contenu:
        "Suivi_eleve : {titre} le {date} ({lieu}). Détails dans l'application.",
    },
    EMAIL: {
      sujet: '{titre} – {date}',
      contenu: `${salutation}{titre}\nDate : {date}\nLieu : {lieu}\n\n{details}${signature}`,
    },
    PUSH: { sujet: '{titre}', contenu: 'Le {date} ({lieu}).' },
  },
  USAGE_APPAREIL: {
    SMS: { contenu: 'Suivi_eleve : {details}' },
    EMAIL: {
      sujet: "Usage d'un appareil en classe – {prenom_eleve}",
      contenu: `${salutation}{details}${signature}`,
    },
    PUSH: { sujet: 'Appareil en classe', contenu: '{details}' },
  },
  APPAREIL: {
    SMS: { contenu: 'Suivi_eleve : {details}' },
    EMAIL: {
      sujet: 'Appareil de {prenom_eleve}',
      contenu: `${salutation}{details}${signature}`,
    },
    PUSH: { sujet: 'Appareil de {prenom_eleve}', contenu: '{details}' },
  },
};
