// Information et consentement du tuteur, demandés à la première connexion
// (et de nouveau si le texte change : la version est stockée avec la date).

export const VERSION_CONSENTEMENT = '2026-10';

export const TEXTE_CONSENTEMENT = [
  "Suivi_eleve est l'application de l'école qui vous informe de la scolarité de votre enfant.",
  "Données utilisées : votre identité et vos contacts (téléphone, email), ainsi que l'identité, la classe, les absences, le comportement, les résultats, les appareils et les paiements en attente de votre enfant, saisis par le personnel de l'école.",
  "Pourquoi : vous prévenir rapidement (SMS, email, notification) et vous permettre de répondre à l'école. Les messages importants (sortie anticipée, absence, comportement, retard de paiement) sont toujours envoyés.",
  "Qui y a accès : seul le personnel autorisé de l'école, selon son rôle. Vous ne voyez que vos propres enfants. Les données ne sont ni vendues ni utilisées pour de la publicité.",
  "Vos droits : vous pouvez demander à l'école une copie des données de votre enfant ou leur effacement après son départ de l'école.",
] as const;
