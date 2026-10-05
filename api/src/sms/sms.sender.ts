/**
 * Envoi immédiat d'un SMS hors file d'attente (codes de connexion des parents).
 * Fourni par NotificationsModule, qui choisit le fournisseur selon la configuration.
 */
export abstract class SmsSender {
  abstract envoyer(telephone: string, message: string): Promise<void>;
}
