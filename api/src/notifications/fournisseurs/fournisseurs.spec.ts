// Format des requêtes envoyées aux fournisseurs, vérifié avec un faux fetch.
import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  verify,
  type ECDH,
} from 'node:crypto';
import webpush from 'web-push';
import {
  BrevoEmail,
  ErreurFournisseur,
  FcmPush,
  JetonPushInvalide,
  OrangeSms,
  TwilioSms,
  WebPush,
  estServicePushWeb,
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

describe('estServicePushWeb', () => {
  it('accepte les services push des navigateurs', () => {
    for (const adresse of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGz1',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(estServicePushWeb(adresse), adresse).toBe(true);
    }
  });

  it('refuse toute autre adresse (pas d’appel vers un serveur interne)', () => {
    for (const adresse of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/x',
      'https://user@fcm.googleapis.com/x',
      'https://fcm.googleapis.com.exemple.com/x',
      'https://notify.windows.com.evil.test/x',
      'https://postgres:5432/',
      'https://localhost/',
      'pas une adresse',
    ]) {
      expect(estServicePushWeb(adresse), adresse).toBe(false);
    }
  });
});

/** Déchiffre un message Web Push (RFC 8291, aes128gcm) comme le ferait le navigateur. */
function dechiffrer(corps: Uint8Array, navigateur: ECDH, secretAuth: Buffer) {
  const b = Buffer.from(corps);
  const sel = b.subarray(0, 16);
  const longueurCle = b[20];
  const clePubliqueServeur = b.subarray(21, 21 + longueurCle);
  const chiffre = b.subarray(21 + longueurCle);
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    navigateur.getPublicKey(),
    clePubliqueServeur,
  ]);
  const ikm = Buffer.from(
    hkdfSync(
      'sha256',
      navigateur.computeSecret(clePubliqueServeur),
      secretAuth,
      info,
      32,
    ),
  );
  const derivee = (texte: string, taille: number) =>
    Buffer.from(hkdfSync('sha256', ikm, sel, Buffer.from(texte), taille));
  const dechiffreur = createDecipheriv(
    'aes-128-gcm',
    derivee('Content-Encoding: aes128gcm\0', 16),
    derivee('Content-Encoding: nonce\0', 12),
  );
  dechiffreur.setAuthTag(chiffre.subarray(-16));
  const clair = Buffer.concat([
    dechiffreur.update(chiffre.subarray(0, -16)),
    dechiffreur.final(),
  ]);
  // Dernier enregistrement : le contenu est suivi du délimiteur 0x02 puis de zéros.
  return clair.subarray(0, clair.lastIndexOf(2)).toString('utf8');
}

describe('WebPush', () => {
  const vapid = webpush.generateVAPIDKeys();
  const config = {
    clePublique: vapid.publicKey,
    clePrivee: vapid.privateKey,
    sujet: 'mailto:direction@ecole.test',
  };
  const navigateur = createECDH('prime256v1');
  navigateur.generateKeys();
  const secretAuth = randomBytes(16);
  const abonnement = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abonnement-test',
    p256dh: navigateur.getPublicKey().toString('base64url'),
    auth: secretAuth.toString('base64url'),
  };

  it('chiffre le message pour le navigateur et signe la demande (VAPID)', async () => {
    const { appels, requete } = fauxFetch(
      new Response(null, { status: 201, headers: { Location: 'msg-1' } }),
    );
    const resultat = await new WebPush(config, requete).envoyer(
      abonnement,
      'Absence',
      'Awa est absente ce matin.',
      { url: '/parent/messages/42' },
    );

    expect(resultat).toEqual({ fournisseur: 'webpush', reference: 'msg-1' });
    const [appel] = appels;
    expect(appel.url).toBe(abonnement.endpoint);
    expect(appel.init.method).toBe('POST');
    const entetes = appel.init.headers as Record<string, string | number>;
    expect(entetes['Content-Encoding']).toBe('aes128gcm');
    expect(String(entetes.TTL)).toBe('86400');

    // Le navigateur, seul détenteur de sa clé privée, retrouve le message.
    const message = JSON.parse(
      dechiffrer(appel.init.body as Uint8Array, navigateur, secretAuth),
    ) as unknown;
    expect(message).toEqual({
      titre: 'Absence',
      texte: 'Awa est absente ce matin.',
      donnees: { url: '/parent/messages/42' },
    });

    // Jeton VAPID signé avec la clé privée du serveur, pour ce service push.
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(
      String(entetes.Authorization),
    )!;
    expect(k).toBe(vapid.publicKey);
    const [entete, charge, signature] = jwt.split('.');
    const brute = Buffer.from(vapid.publicKey, 'base64url');
    const cle = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: brute.subarray(1, 33).toString('base64url'),
        y: brute.subarray(33, 65).toString('base64url'),
      },
      format: 'jwk',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${entete}.${charge}`),
        { key: cle, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
    expect(
      JSON.parse(Buffer.from(charge, 'base64url').toString()),
    ).toMatchObject({
      aud: 'https://fcm.googleapis.com',
      sub: 'mailto:direction@ecole.test',
    });
  });

  it('signale un abonnement expiré (410) pour qu’il soit supprimé', async () => {
    const { requete } = fauxFetch(new Response('Gone', { status: 410 }));
    const erreur = await new WebPush(config, requete)
      .envoyer(abonnement, 'T', 'x', {})
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(JetonPushInvalide);
  });

  it('n’envoie rien vers une adresse qui n’est pas un service push', async () => {
    const { appels, requete } = fauxFetch();
    const erreur = await new WebPush(config, requete)
      .envoyer({ ...abonnement, endpoint: 'https://postgres/' }, 'T', 'x', {})
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(JetonPushInvalide);
    expect(appels).toHaveLength(0);
  });
});
