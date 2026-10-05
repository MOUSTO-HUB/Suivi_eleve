// Fournisseurs d'envoi : SMS (Orange, Twilio), email (Brevo), push (Firebase Cloud Messaging),
// plus « console » (développement) et « simulation » (tests).
import { Logger } from '@nestjs/common';
import { createSign } from 'node:crypto';

export interface ResultatEnvoi {
  fournisseur: string;
  /** Identifiant chez le fournisseur : sert à rattacher les accusés de livraison. */
  reference?: string;
  /** Coût en FCFA, s'il est connu. */
  cout?: number;
}

export interface Rappel {
  /** Identifiant de la notification, renvoyé par certains fournisseurs. */
  identifiant: string;
  /** URL publique de l'accusé de livraison (webhook), si configurée. */
  url?: string;
}

/** Erreur d'envoi ; `definitive` = inutile de réessayer (numéro invalide, jeton expiré…). */
export class ErreurFournisseur extends Error {
  constructor(
    message: string,
    readonly definitive = false,
  ) {
    super(message);
  }
}

export interface FournisseurSms {
  readonly nom: string;
  envoyer(
    numero: string,
    texte: string,
    rappel: Rappel,
  ): Promise<ResultatEnvoi>;
}

export interface FournisseurEmail {
  readonly nom: string;
  envoyer(
    adresse: string,
    sujet: string,
    texte: string,
    rappel: Rappel,
  ): Promise<ResultatEnvoi>;
}

export interface FournisseurPush {
  readonly nom: string;
  envoyer(
    jeton: string,
    titre: string,
    texte: string,
    donnees: Record<string, string>,
  ): Promise<ResultatEnvoi>;
}

type Fetch = typeof fetch;

/** Lit le corps d'une réponse en échec pour un message d'erreur utile. */
async function detailErreur(reponse: Response): Promise<string> {
  const texte = await reponse.text().catch(() => '');
  return `HTTP ${reponse.status}${texte ? ` : ${texte.slice(0, 300)}` : ''}`;
}

/** 4xx (hors 401, 408, 429) : la demande elle-même est refusée, réessayer ne sert à rien. */
const estDefinitive = (statut: number) =>
  statut >= 400 && statut < 500 && ![401, 408, 429].includes(statut);

// ─── Orange SMS API ──────────────────────────────────────────────────────────

export interface ConfigOrange {
  clientId: string;
  clientSecret: string;
  /** Numéro expéditeur au format E.164, ex. +221770000000. */
  expediteur: string;
  /** Nom affiché à la place du numéro, s'il est validé par Orange. */
  nomExpediteur?: string;
}

export class OrangeSms implements FournisseurSms {
  readonly nom = 'orange';
  private jeton?: { valeur: string; expireLe: number };

  constructor(
    private readonly config: ConfigOrange,
    private readonly requete: Fetch = fetch,
  ) {}

  private async jetonAcces(): Promise<string> {
    if (this.jeton && this.jeton.expireLe > Date.now() + 60_000)
      return this.jeton.valeur;
    const identifiants = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');
    const reponse = await this.requete(
      'https://api.orange.com/oauth/v3/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${identifiants}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
      },
    );
    if (!reponse.ok) {
      throw new ErreurFournisseur(
        `Orange, authentification : ${await detailErreur(reponse)}`,
      );
    }
    const corps = (await reponse.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.jeton = {
      valeur: corps.access_token,
      expireLe: Date.now() + corps.expires_in * 1000,
    };
    return this.jeton.valeur;
  }

  async envoyer(
    numero: string,
    texte: string,
    rappel: Rappel,
  ): Promise<ResultatEnvoi> {
    const expediteur = `tel:${this.config.expediteur}`;
    const reponse = await this.requete(
      `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(expediteur)}/requests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.jetonAcces()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: `tel:${numero}`,
            senderAddress: expediteur,
            ...(this.config.nomExpediteur
              ? { senderName: this.config.nomExpediteur }
              : {}),
            outboundSMSTextMessage: { message: texte },
            ...(rappel.url
              ? {
                  receiptRequest: {
                    notifyURL: rappel.url,
                    callbackData: rappel.identifiant,
                  },
                }
              : {}),
          },
        }),
      },
    );
    if (reponse.status === 401) this.jeton = undefined;
    if (!reponse.ok) {
      throw new ErreurFournisseur(
        `Orange : ${await detailErreur(reponse)}`,
        estDefinitive(reponse.status),
      );
    }
    const corps = (await reponse.json()) as {
      outboundSMSMessageRequest?: { resourceURL?: string };
    };
    const url = corps.outboundSMSMessageRequest?.resourceURL;
    return { fournisseur: this.nom, reference: url?.split('/').at(-1) };
  }
}

// ─── Twilio ──────────────────────────────────────────────────────────────────

export interface ConfigTwilio {
  accountSid: string;
  authToken: string;
  expediteur: string;
}

export class TwilioSms implements FournisseurSms {
  readonly nom = 'twilio';

  constructor(
    private readonly config: ConfigTwilio,
    private readonly requete: Fetch = fetch,
  ) {}

  async envoyer(
    numero: string,
    texte: string,
    rappel: Rappel,
  ): Promise<ResultatEnvoi> {
    const formulaire = new URLSearchParams({
      To: numero,
      From: this.config.expediteur,
      Body: texte,
    });
    if (rappel.url) formulaire.set('StatusCallback', rappel.url);
    const identifiants = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`,
    ).toString('base64');
    const reponse = await this.requete(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${identifiants}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formulaire.toString(),
      },
    );
    if (!reponse.ok) {
      throw new ErreurFournisseur(
        `Twilio : ${await detailErreur(reponse)}`,
        estDefinitive(reponse.status),
      );
    }
    const corps = (await reponse.json()) as { sid: string };
    return { fournisseur: this.nom, reference: corps.sid };
  }
}

// ─── Brevo (email) ───────────────────────────────────────────────────────────

export interface ConfigBrevo {
  cleApi: string;
  expediteur: string;
  nomExpediteur: string;
}

const echapperHtml = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class BrevoEmail implements FournisseurEmail {
  readonly nom = 'brevo';

  constructor(
    private readonly config: ConfigBrevo,
    private readonly requete: Fetch = fetch,
  ) {}

  async envoyer(
    adresse: string,
    sujet: string,
    texte: string,
    rappel: Rappel,
  ): Promise<ResultatEnvoi> {
    const html = echapperHtml(texte)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    const reponse = await this.requete('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.config.cleApi,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: this.config.expediteur,
          name: this.config.nomExpediteur,
        },
        to: [{ email: adresse }],
        subject: sujet,
        textContent: texte,
        htmlContent: `<html><body style="font-family:sans-serif;line-height:1.5">${html}</body></html>`,
        headers: { 'X-Suivi-Notification': rappel.identifiant },
      }),
    });
    if (!reponse.ok) {
      throw new ErreurFournisseur(
        `Brevo : ${await detailErreur(reponse)}`,
        estDefinitive(reponse.status),
      );
    }
    const corps = (await reponse.json()) as { messageId: string };
    return { fournisseur: this.nom, reference: corps.messageId };
  }
}

// ─── Firebase Cloud Messaging (push) ─────────────────────────────────────────

export interface ConfigFcm {
  projetId: string;
  emailCompteService: string;
  /** Clé privée PEM du compte de service (les \n littéraux sont acceptés). */
  clePrivee: string;
}

/** Jeton push refusé par FCM (application désinstallée…) : à supprimer. */
export class JetonPushInvalide extends ErreurFournisseur {
  constructor(message: string) {
    super(message, true);
  }
}

export class FcmPush implements FournisseurPush {
  readonly nom = 'fcm';
  private jeton?: { valeur: string; expireLe: number };

  constructor(
    private readonly config: ConfigFcm,
    private readonly requete: Fetch = fetch,
  ) {}

  /** Jeton OAuth 2.0 obtenu en signant un JWT avec la clé du compte de service. */
  private async jetonAcces(): Promise<string> {
    if (this.jeton && this.jeton.expireLe > Date.now() + 60_000)
      return this.jeton.valeur;
    const maintenant = Math.floor(Date.now() / 1000);
    const encoder = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const nonSigne = `${encoder({ alg: 'RS256', typ: 'JWT' })}.${encoder({
      iss: this.config.emailCompteService,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: maintenant,
      exp: maintenant + 3600,
    })}`;
    const signature = createSign('RSA-SHA256')
      .update(nonSigne)
      .sign(this.config.clePrivee.replace(/\\n/g, '\n'), 'base64url');

    const reponse = await this.requete('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${nonSigne}.${signature}`,
      }).toString(),
    });
    if (!reponse.ok) {
      throw new ErreurFournisseur(
        `FCM, authentification : ${await detailErreur(reponse)}`,
      );
    }
    const corps = (await reponse.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.jeton = {
      valeur: corps.access_token,
      expireLe: Date.now() + corps.expires_in * 1000,
    };
    return this.jeton.valeur;
  }

  async envoyer(
    jeton: string,
    titre: string,
    texte: string,
    donnees: Record<string, string>,
  ): Promise<ResultatEnvoi> {
    const reponse = await this.requete(
      `https://fcm.googleapis.com/v1/projects/${this.config.projetId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.jetonAcces()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: jeton,
            notification: { title: titre, body: texte },
            data: donnees,
          },
        }),
      },
    );
    if (reponse.status === 404 || reponse.status === 400) {
      const detail = await detailErreur(reponse);
      if (reponse.status === 404 || detail.includes('UNREGISTERED')) {
        throw new JetonPushInvalide(`FCM : jeton invalide (${detail})`);
      }
      throw new ErreurFournisseur(`FCM : ${detail}`, true);
    }
    if (reponse.status === 401) this.jeton = undefined;
    if (!reponse.ok) {
      throw new ErreurFournisseur(`FCM : ${await detailErreur(reponse)}`);
    }
    const corps = (await reponse.json()) as { name: string };
    return { fournisseur: this.nom, reference: corps.name };
  }
}

// ─── Développement et tests ──────────────────────────────────────────────────

/** Écrit les messages dans les logs. Développement uniquement. */
export class FournisseurConsole
  implements FournisseurSms, FournisseurEmail, FournisseurPush
{
  readonly nom = 'console';
  private readonly logger = new Logger('Envoi simulé');

  envoyer(
    destinataire: string,
    a: string,
    b?: string | Rappel,
  ): Promise<ResultatEnvoi> {
    const texte = typeof b === 'string' ? `${a} — ${b}` : a;
    this.logger.log(`vers ${destinataire} : ${texte}`);
    return Promise.resolve({ fournisseur: this.nom });
  }
}

export interface EnvoiSimule {
  fournisseur: string;
  destinataire: string;
  texte: string;
  sujet?: string;
}

/** Messages « envoyés » par les fournisseurs de simulation (lus par les tests). */
export const ENVOIS_SIMULES: EnvoiSimule[] = [];

/**
 * Fournisseur de test : enregistre les envois en mémoire et échoue pour les
 * destinataires qui finissent par `suffixeEchec` (pour tester les reprises).
 */
export class FournisseurSimule
  implements FournisseurSms, FournisseurEmail, FournisseurPush
{
  private compteur = 0;

  constructor(
    readonly nom: string,
    private readonly suffixeEchec: string,
  ) {}

  envoyer(
    destinataire: string,
    a: string,
    b?: string | Rappel,
  ): Promise<ResultatEnvoi> {
    if (destinataire.endsWith(this.suffixeEchec)) {
      return Promise.reject(
        new ErreurFournisseur(
          `${this.nom} : échec simulé pour ${destinataire}`,
        ),
      );
    }
    const [sujet, texte] = typeof b === 'string' ? [a, b] : [undefined, a];
    ENVOIS_SIMULES.push({ fournisseur: this.nom, destinataire, texte, sujet });
    return Promise.resolve({
      fournisseur: this.nom,
      reference: `${this.nom}-${++this.compteur}-${Date.now()}`,
      cout: 0,
    });
  }
}
