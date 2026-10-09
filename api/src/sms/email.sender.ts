/**
 * Envoi immédiat d'un email hors file d'attente (code de double authentification,
 * lien « mot de passe oublié », alerte de blocage du compte).
 * Fourni par NotificationsModule, qui choisit le fournisseur selon la configuration.
 */
export abstract class EmailSender {
  abstract envoyer(
    adresse: string,
    sujet: string,
    texte: string,
  ): Promise<void>;
}
