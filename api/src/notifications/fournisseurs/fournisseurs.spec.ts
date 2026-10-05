// Format des requêtes envoyées aux fournisseurs, vérifié avec un faux fetch.
import { generateKeyPairSync } from 'node:crypto';
import {
  BrevoEmail,
  ErreurFournisseur,
  FcmPush,
  JetonPushInvalide,
  OrangeSms,
  TwilioSms,
} from './fournisseurs.js';

interface Appel {
  url: string;
  init: RequestInit;
}

/** Faux fetch : enregistre les appels et rend les réponses données, dans l'ordre. */
function fauxFetch(...reponses: Response[]) {
  const appels: Appel[] = [];
  const requete = (url: string | URL | Request, init?: RequestInit) => {
    appels.push({
      url: url instanceof Request ? url.url : url.toString(),
      init: init ?? {},
    });
    const reponse = reponses.shift();
    if (!reponse) throw new Error('Appel inattendu');
    return Promise.resolve(reponse);
  };
  return { appels, requete: requete as typeof fetch };
}

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

const texteCorps = (a: Appel) =>
  typeof a.init.body === 'string' ? a.init.body : '';
const corps = (a: Appel) =>
  JSON.parse(texteCorps(a)) as Record<string, unknown>;
const entete = (a: Appel, nom: string) => new Headers(a.init.headers).get(nom);

describe('OrangeSms', () => {
  const config = {
    clientId: 'id',
    clientSecret: 'secret',
    expediteur: '+221770000000',
    nomExpediteur: 'ECOLE',
  };

  it('obtient un jeton puis envoie, et réutilise le jeton', async () => {
    const { appels, requete } = fauxFetch(
      json({ access_token: 'jeton-orange', expires_in: 3600 }),
      json(
        {
          outboundSMSMessageRequest: {
            resourceURL:
              'https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B221770000000/requests/abc123',
          },
        },
        201,
      ),
      json(
        { outboundSMSMessageRequest: { resourceURL: '.../requests/def456' } },
        201,
      ),
    );
    const orange = new OrangeSms(config, requete);

    const resultat = await orange.envoyer('+221771234567', 'Bonjour', {
      identifiant: 'notif-1',
      url: 'https://api.ecole.sn/api/notifications/webhooks/orange?jeton=s',
    });
    expect(resultat).toEqual({ fournisseur: 'orange', reference: 'abc123' });

    expect(appels[0].url).toBe('https://api.orange.com/oauth/v3/token');
    expect(entete(appels[0], 'Authorization')).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`,
    );
    expect(appels[0].init.body).toBe('grant_type=client_credentials');

    expect(appels[1].url).toBe(
      'https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B221770000000/requests',
    );
    expect(entete(appels[1], 'Authorization')).toBe('Bearer jeton-orange');
    expect(corps(appels[1])).toEqual({
      outboundSMSMessageRequest: {
        address: 'tel:+221771234567',
        senderAddress: 'tel:+221770000000',
        senderName: 'ECOLE',
        outboundSMSTextMessage: { message: 'Bonjour' },
        receiptRequest: {
          notifyURL:
            'https://api.ecole.sn/api/notifications/webhooks/orange?jeton=s',
          callbackData: 'notif-1',
        },
      },
    });

    await orange.envoyer('+221771234568', 'Encore', { identifiant: 'notif-2' });
    expect(appels).toHaveLength(3);
  });

  it('classe un refus 400 comme définitif et une panne 503 comme temporaire', async () => {
    const jeton = () => json({ access_token: 't', expires_in: 3600 });
    const refus = new OrangeSms(
      config,
      fauxFetch(jeton(), json({}, 400)).requete,
    );
    await expect(
      refus.envoyer('+221', 'x', { identifiant: 'a' }),
    ).rejects.toMatchObject({
      definitive: true,
    });
    const panne = new OrangeSms(
      config,
      fauxFetch(jeton(), json({}, 503)).requete,
    );
    await expect(
      panne.envoyer('+221', 'x', { identifiant: 'a' }),
    ).rejects.toMatchObject({
      definitive: false,
    });
  });
});

describe('TwilioSms', () => {
  it('envoie un formulaire avec l’URL d’accusé de livraison', async () => {
    const { appels, requete } = fauxFetch(
      json({ sid: 'SM123', status: 'queued' }, 201),
    );
    const twilio = new TwilioSms(
      { accountSid: 'AC1', authToken: 'tok', expediteur: '+15550001111' },
      requete,
    );
    const resultat = await twilio.envoyer('+221771234567', 'Bonjour', {
      identifiant: 'n',
      url: 'https://api.ecole.sn/rappel',
    });
    expect(resultat).toEqual({ fournisseur: 'twilio', reference: 'SM123' });
    expect(appels[0].url).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json',
    );
    expect(entete(appels[0], 'Authorization')).toBe(
      `Basic ${Buffer.from('AC1:tok').toString('base64')}`,
    );
    expect(
      Object.fromEntries(new URLSearchParams(texteCorps(appels[0]))),
    ).toEqual({
      To: '+221771234567',
      From: '+15550001111',
      Body: 'Bonjour',
      StatusCallback: 'https://api.ecole.sn/rappel',
    });
  });
});

describe('BrevoEmail', () => {
  it('envoie texte et HTML échappé', async () => {
    const { appels, requete } = fauxFetch(
      json({ messageId: '<m1@brevo>' }, 201),
    );
    const brevo = new BrevoEmail(
      { cleApi: 'cle', expediteur: 'ecole@exemple.sn', nomExpediteur: 'École' },
      requete,
    );
    const resultat = await brevo.envoyer(
      'parent@exemple.sn',
      'Sujet',
      'Bonjour,\n\nNote < 10 & rang 3',
      { identifiant: 'n1' },
    );
    expect(resultat).toEqual({ fournisseur: 'brevo', reference: '<m1@brevo>' });
    expect(appels[0].url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(entete(appels[0], 'api-key')).toBe('cle');
    const envoye = corps(appels[0]);
    expect(envoye).toMatchObject({
      sender: { email: 'ecole@exemple.sn', name: 'École' },
      to: [{ email: 'parent@exemple.sn' }],
      subject: 'Sujet',
      textContent: 'Bonjour,\n\nNote < 10 & rang 3',
    });
    expect(envoye.htmlContent).toContain(
      '<p>Bonjour,</p><p>Note &lt; 10 &amp; rang 3</p>',
    );
  });
});

describe('FcmPush', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = {
    projetId: 'suivi-eleve',
    emailCompteService: 'push@suivi-eleve.iam.gserviceaccount.com',
    clePrivee: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  it('signe un JWT de compte de service puis envoie le message', async () => {
    const { appels, requete } = fauxFetch(
      json({ access_token: 'jeton-google', expires_in: 3600 }),
      json({ name: 'projects/suivi-eleve/messages/42' }),
    );
    const fcm = new FcmPush(config, requete);
    const resultat = await fcm.envoyer('jeton-appareil', 'Titre', 'Texte', {
      lotId: 'l1',
    });
    expect(resultat).toEqual({
      fournisseur: 'fcm',
      reference: 'projects/suivi-eleve/messages/42',
    });

    const assertion = new URLSearchParams(texteCorps(appels[0])).get(
      'assertion',
    )!;
    const charge = JSON.parse(
      Buffer.from(assertion.split('.')[1], 'base64url').toString(),
    );
    expect(charge).toMatchObject({
      iss: config.emailCompteService,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
    });
    expect(appels[1].url).toBe(
      'https://fcm.googleapis.com/v1/projects/suivi-eleve/messages:send',
    );
    expect(corps(appels[1])).toEqual({
      message: {
        token: 'jeton-appareil',
        notification: { title: 'Titre', body: 'Texte' },
        data: { lotId: 'l1' },
      },
    });
  });

  it('signale un jeton d’appareil périmé', async () => {
    const fcm = new FcmPush(
      config,
      fauxFetch(
        json({ access_token: 't', expires_in: 3600 }),
        json(
          {
            error: {
              status: 'NOT_FOUND',
              details: [{ errorCode: 'UNREGISTERED' }],
            },
          },
          404,
        ),
      ).requete,
    );
    const erreur = await fcm
      .envoyer('vieux', 'T', 'x', {})
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(JetonPushInvalide);
    expect(erreur).toBeInstanceOf(ErreurFournisseur);
  });
});
