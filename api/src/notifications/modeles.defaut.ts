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
  RAPPEL_PAIEMENT: {
    SMS: {
      contenu:
        'Suivi_eleve : rappel, la mensualité de {mois} de {prenom_eleve} ({montant} FCFA) est à régler avant le {date_limite}.',
    },
    EMAIL: {
      sujet: 'Rappel : mensualité de {mois}',
      contenu: `${salutation}La mensualité de {mois} pour {prenom_eleve} ({montant} FCFA) est à régler avant le {date_limite}.${signature}`,
    },
    PUSH: {
      sujet: 'Mensualité de {mois}',
      contenu: '{montant} FCFA à régler avant le {date_limite}.',
    },
  },
  RETARD_PAIEMENT: {
    SMS: {
      contenu:
        'Suivi_eleve : la mensualité de {mois} de {prenom_eleve} ({montant} FCFA) est en retard de {jours_retard} jours. Merci de régulariser.',
    },
    EMAIL: {
      sujet: 'Retard de paiement : mensualité de {mois}',
      contenu: `${salutation}La mensualité de {mois} pour {prenom_eleve} ({montant} FCFA restant dû) est en retard de {jours_retard} jours. Merci de régulariser auprès de la comptabilité.${signature}`,
    },
    PUSH: {
      sujet: 'Paiement en retard',
      contenu: '{mois} : {montant} FCFA en retard de {jours_retard} jours.',
    },
  },
  RECU_PAIEMENT: {
    SMS: {
      contenu:
        'Suivi_eleve : paiement de {montant} FCFA reçu ({mois}). Reçu n° {numero_recu}.',
    },
    EMAIL: {
      sujet: 'Reçu de paiement n° {numero_recu}',
      contenu: `${salutation}Nous avons bien reçu votre paiement de {montant} FCFA pour {prenom_eleve} ({mois}). Reçu n° {numero_recu}.${signature}`,
    },
    PUSH: {
      sujet: 'Paiement reçu',
      contenu: '{montant} FCFA ({mois}), reçu n° {numero_recu}.',
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
