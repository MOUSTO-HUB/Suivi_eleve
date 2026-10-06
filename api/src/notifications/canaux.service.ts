import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BrevoEmail,
  ErreurFournisseur,
  FcmPush,
  FournisseurConsole,
  FournisseurSimule,
  OrangeSms,
  TwilioSms,
  WebPush,
  type AbonnementWeb,
  type FournisseurEmail,
  type FournisseurPush,
  type FournisseurPushWeb,
  type FournisseurSms,
  type Rappel,
  type ResultatEnvoi,
} from './fournisseurs/fournisseurs.js';

/**
 * Choisit les fournisseurs selon la configuration (SMS_FOURNISSEUR,
 * SMS_FOURNISSEUR_SECOURS, EMAIL_FOURNISSEUR, PUSH_FOURNISSEUR) et envoie.
 * Les SMS basculent sur le fournisseur de secours si le principal échoue.
 */
@Injectable()
export class CanauxService {
  private readonly logger = new Logger(CanauxService.name);
  readonly sms: FournisseurSms[];
  readonly email: FournisseurEmail;
  readonly push: FournisseurPush;
  /** Web Push du site installable ; absent sans clés VAPID. */
  readonly pushWeb?: FournisseurPushWeb;
  /** Clé publique VAPID donnée aux navigateurs pour s'abonner. */
  readonly clePubliqueVapid?: string;
  private readonly urlRappels?: string;
  private readonly coutSms?: number;

  constructor(private readonly config: ConfigService) {
    const principal = config.get<string>('SMS_FOURNISSEUR', 'console');
    const secours = config.get<string>('SMS_FOURNISSEUR_SECOURS');
    this.sms = [principal, secours]
      .filter((nom): nom is string => Boolean(nom))
      .map((nom) => this.creerSms(nom));
    this.email = this.creerEmail(
      config.get<string>('EMAIL_FOURNISSEUR', 'console'),
    );
    this.push = this.creerPush(
      config.get<string>('PUSH_FOURNISSEUR', 'console'),
    );
    const clePublique = config.get<string>('VAPID_CLE_PUBLIQUE');
    if (clePublique) {
      this.clePubliqueVapid = clePublique;
      this.pushWeb = new WebPush({
        clePublique,
        clePrivee: this.exiger('VAPID_CLE_PRIVEE'),
        sujet: this.exiger('VAPID_SUJET'),
      });
    }

    const urlApi = config.get<string>('API_URL_PUBLIQUE');
    const secret = config.get<string>('WEBHOOK_SECRET');
    if (urlApi && secret)
      this.urlRappels = `${urlApi.replace(/\/$/, '')}/notifications/webhooks`;
    const cout = Number(config.get('SMS_COUT_FCFA'));
    this.coutSms = Number.isFinite(cout) && cout > 0 ? cout : undefined;
  }

  /** URL de l'accusé de livraison d'un fournisseur, si l'API est joignable de l'extérieur. */
  private rappel(fournisseur: string, identifiant: string): Rappel {
    const secret = this.config.get<string>('WEBHOOK_SECRET');
    return {
      identifiant,
      url: this.urlRappels
        ? `${this.urlRappels}/${fournisseur}?jeton=${encodeURIComponent(secret ?? '')}`
        : undefined,
    };
  }

  async envoyerSms(
    numero: string,
    texte: string,
    identifiant: string,
  ): Promise<ResultatEnvoi> {
    const erreurs: ErreurFournisseur[] = [];
    for (const fournisseur of this.sms) {
      try {
        const resultat = await fournisseur.envoyer(
          numero,
          texte,
          this.rappel(fournisseur.nom, identifiant),
        );
        return { ...resultat, cout: resultat.cout ?? this.coutSms };
      } catch (e) {
        const erreur =
          e instanceof ErreurFournisseur ? e : new ErreurFournisseur(String(e));
        this.logger.warn(
          `SMS via ${fournisseur.nom} en échec : ${erreur.message}`,
        );
        erreurs.push(erreur);
      }
    }
    throw new ErreurFournisseur(
      erreurs.map((e) => e.message).join(' | '),
      erreurs.every((e) => e.definitive),
    );
  }

  envoyerEmail(
    adresse: string,
    sujet: string,
    texte: string,
    identifiant: string,
  ) {
    return this.email.envoyer(
      adresse,
      sujet,
      texte,
      this.rappel(this.email.nom, identifiant),
    );
  }

  envoyerPush(
    jeton: string,
    titre: string,
    texte: string,
    donnees: Record<string, string>,
  ) {
    return this.push.envoyer(jeton, titre, texte, donnees);
  }

  envoyerPushWeb(
    abonnement: AbonnementWeb,
    titre: string,
    texte: string,
    donnees: Record<string, string>,
  ): Promise<ResultatEnvoi> {
    if (this.pushWeb)
      return this.pushWeb.envoyer(abonnement, titre, texte, donnees);
    // Sans clés VAPID, en développement et en test : même faux fournisseur que les autres push.
    if (
      this.push instanceof FournisseurConsole ||
      this.push instanceof FournisseurSimule
    )
      return this.push.envoyer(abonnement.endpoint, titre, texte);
    return Promise.reject(
      new ErreurFournisseur(
        'Web Push non configuré (VAPID_CLE_PUBLIQUE, VAPID_CLE_PRIVEE, VAPID_SUJET).',
        true,
      ),
    );
  }

  private exiger(cle: string): string {
    const valeur = this.config.get<string>(cle);
    if (!valeur) throw new Error(`Configuration manquante : ${cle}.`);
    return valeur;
  }

  private interditEnProduction(nom: string, canal: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        `${canal}=${nom} est interdit en production : configurez un fournisseur réel.`,
      );
    }
  }

  private creerSms(nom: string): FournisseurSms {
    switch (nom) {
      case 'orange':
        return new OrangeSms({
          clientId: this.exiger('ORANGE_CLIENT_ID'),
          clientSecret: this.exiger('ORANGE_CLIENT_SECRET'),
          expediteur: this.exiger('ORANGE_NUMERO_EXPEDITEUR'),
          nomExpediteur: this.config.get<string>('ORANGE_NOM_EXPEDITEUR'),
        });
      case 'twilio':
        return new TwilioSms({
          accountSid: this.exiger('TWILIO_ACCOUNT_SID'),
          authToken: this.exiger('TWILIO_AUTH_TOKEN'),
          expediteur: this.exiger('TWILIO_NUMERO_EXPEDITEUR'),
        });
      case 'console':
        this.interditEnProduction(nom, 'SMS_FOURNISSEUR');
        return new FournisseurConsole();
      case 'simulation':
        this.interditEnProduction(nom, 'SMS_FOURNISSEUR');
        return new FournisseurSimule('simulation', '0000');
      case 'simulation-secours':
        this.interditEnProduction(nom, 'SMS_FOURNISSEUR_SECOURS');
        return new FournisseurSimule('simulation-secours', '00000');
      default:
        throw new Error(`Fournisseur SMS inconnu : ${nom}`);
    }
  }

  private creerEmail(nom: string): FournisseurEmail {
    switch (nom) {
      case 'brevo':
        return new BrevoEmail({
          cleApi: this.exiger('BREVO_API_KEY'),
          expediteur: this.exiger('EMAIL_EXPEDITEUR'),
          nomExpediteur: this.config.get<string>(
            'EMAIL_NOM_EXPEDITEUR',
            'Suivi_eleve',
          ),
        });
      case 'console':
        this.interditEnProduction(nom, 'EMAIL_FOURNISSEUR');
        return new FournisseurConsole();
      case 'simulation':
        this.interditEnProduction(nom, 'EMAIL_FOURNISSEUR');
        return new FournisseurSimule('simulation-email', '@echec.test');
      default:
        throw new Error(`Fournisseur email inconnu : ${nom}`);
    }
  }

  private creerPush(nom: string): FournisseurPush {
    switch (nom) {
      case 'fcm':
        return new FcmPush({
          projetId: this.exiger('FCM_PROJET_ID'),
          emailCompteService: this.exiger('FCM_EMAIL_COMPTE_SERVICE'),
          clePrivee: this.exiger('FCM_CLE_PRIVEE'),
        });
      case 'console':
        this.interditEnProduction(nom, 'PUSH_FOURNISSEUR');
        return new FournisseurConsole();
      case 'simulation':
        this.interditEnProduction(nom, 'PUSH_FOURNISSEUR');
        return new FournisseurSimule('simulation-push', 'echec');
      default:
        throw new Error(`Fournisseur push inconnu : ${nom}`);
    }
  }
}
