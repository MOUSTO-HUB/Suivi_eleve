// Connexion des parents sans SMS : code par email et « code inversé » WhatsApp.
// Le test crée ses propres données dans une école dédiée et les supprime à la fin.
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import { WhatsappClient } from '../src/auth/whatsapp.client.js';
import { Genre, LienTuteur, Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EmailSender } from '../src/sms/email.sender.js';
import { SmsSender } from '../src/sms/sms.sender.js';
import { altcha } from './connexion.js';

const SECRET = 'secret-application-test';
const VERIFICATION = 'jeton-verification-test';

/** Client WhatsApp de test : garde les réponses au lieu de les envoyer à Meta. */
class WhatsappCapture extends WhatsappClient {
  reponses: { telephone: string; texte: string }[] = [];
  constructor() {
    super(
      new ConfigService({
        WHATSAPP_NUMERO: '+224620000000',
        WHATSAPP_SECRET_APPLICATION: SECRET,
        WHATSAPP_JETON_VERIFICATION: VERIFICATION,
      }),
    );
  }
  override repondre(telephone: string, texte: string) {
    this.reponses.push({ telephone, texte });
    return Promise.resolve();
  }
}

class EmailCapture extends EmailSender {
  derniers: { adresse: string; texte: string }[] = [];
  envoyer(adresse: string, _sujet: string, texte: string) {
    this.derniers.push({ adresse, texte });
    return Promise.resolve();
  }
}

/** SMS coupés, comme en production sans forfait (SMS_FOURNISSEUR=aucun). */
class SansSms extends SmsSender {
  envoyer(): Promise<void> {
    return Promise.reject(new Error('SMS coupés'));
  }
  override disponible() {
    return false;
  }
}

describe('Connexion des parents par email et WhatsApp (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const whatsapp = new WhatsappCapture();
  const emails = new EmailCapture();

  const ecoleId = randomUUID();
  const telephoneParent = `+22462${randomInt(1_000_000, 9_999_999)}`;
  const autreTelephone = `+22462${randomInt(1_000_000, 9_999_999)}`;
  const emailParent = `parent-${ecoleId}@test.gn`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WhatsappClient)
      .useValue(whatsapp)
      .overrideProvider(EmailSender)
      .useValue(emails)
      .overrideProvider(SmsSender)
      .useValue(new SansSms())
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.ecole.create({
      data: { id: ecoleId, nom: 'École de test connexion parents' },
    });
    const tuteur = await prisma.tuteur.create({
      data: {
        ecoleId,
        prenoms: 'Mariama',
        nom: 'Test',
        contact1: telephoneParent,
        email: emailParent,
      },
    });
    const eleve = await prisma.eleve.create({
      data: {
        ecoleId,
        matricule: `E2E-${ecoleId}`,
        prenoms: 'Alpha',
        nom: 'Test',
        genre: Genre.MASCULIN,
        dateNaissance: new Date('2015-05-01'),
      },
    });
    await prisma.eleveTuteur.create({
      data: {
        eleveId: eleve.id,
        tuteurId: tuteur.id,
        lien: LienTuteur.MERE,
        principal: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.demandeConnexionWhatsapp.deleteMany({
      where: { telephone: { in: [telephoneParent, autreTelephone] } },
    });
    await prisma.codeOtp.deleteMany({ where: { telephone: telephoneParent } });
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.eleve.deleteMany({ where: { ecoleId } });
    await prisma.tuteur.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** Notification de Meta : un message texte reçu, signé avec le secret de l'application. */
  const messageRecu = (de: string, texte: string, secret = SECRET) => {
    const corps = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: de.replace('+', ''),
                    type: 'text',
                    text: { body: texte },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const signature = `sha256=${createHmac('sha256', secret).update(corps).digest('hex')}`;
    return http()
      .post('/api/auth/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(corps);
  };

  const demanderWhatsapp = async (telephone: string) =>
    (
      await http()
        .post('/api/auth/whatsapp/demande')
        .send({ telephone, altcha: altcha() })
        .expect(201)
    ).body as { jeton: string; code: string; message: string; lien: string };

  it('annonce les moyens de connexion : sans SMS, avec email et WhatsApp', async () => {
    const { body } = await http().get('/api/auth/parents/canaux').expect(200);
    expect(body).toEqual({ sms: false, email: true, whatsapp: true });
  });

  it('refuse le code par SMS quand les SMS sont coupés', () =>
    http()
      .post('/api/auth/otp/demande')
      .send({ telephone: telephoneParent, altcha: altcha() })
      .expect(400));

  it('envoie le code par email au tuteur et le connecte', async () => {
    await http()
      .post('/api/auth/otp/demande')
      .send({ telephone: telephoneParent, canal: 'EMAIL', altcha: altcha() })
      .expect(202);
    const recu = emails.derniers.at(-1);
    expect(recu?.adresse).toBe(emailParent);
    const code = /\b(\d{6})\b/.exec(recu?.texte ?? '')?.[1];
    expect(code).toBeTruthy();

    const { body } = await http()
      .post('/api/auth/otp/verification')
      .send({ telephone: telephoneParent, code })
      .expect(200);
    expect(body.utilisateur.role).toBe(Role.PARENT);
  });

  it("n'envoie rien par email à un numéro inconnu, avec la même réponse", async () => {
    const avant = emails.derniers.length;
    await http()
      .post('/api/auth/otp/demande')
      .send({ telephone: autreTelephone, canal: 'EMAIL', altcha: altcha() })
      .expect(202);
    expect(emails.derniers.length).toBe(avant);
  });

  it('vérifie le webhook auprès de Meta avec le jeton choisi', async () => {
    const { text } = await http()
      .get('/api/auth/whatsapp/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFICATION,
        'hub.challenge': '1158201444',
      })
      .expect(200);
    expect(text).toBe('1158201444');
    await http()
      .get('/api/auth/whatsapp/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'faux',
        'hub.challenge': 'x',
      })
      .expect(403);
  });

  it('refuse un message dont la signature est fausse', async () => {
    const demande = await demanderWhatsapp(telephoneParent);
    await messageRecu(telephoneParent, demande.message, 'autre-secret').expect(
      401,
    );
    const { body } = await http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: demande.jeton })
      .expect(200);
    expect(body).toEqual({ statut: 'EN_ATTENTE' });
  });

  it('ne valide pas un code envoyé depuis un autre numéro', async () => {
    const demande = await demanderWhatsapp(telephoneParent);
    expect(demande.lien).toMatch(/^https:\/\/wa\.me\/224620000000\?text=/);
    await messageRecu(autreTelephone, demande.message).expect(200);
    expect(whatsapp.reponses.at(-1)?.telephone).toBe(autreTelephone);
    const { body } = await http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: demande.jeton })
      .expect(200);
    expect(body).toEqual({ statut: 'EN_ATTENTE' });
  });

  it('connecte le parent dès que son message arrive, une seule fois', async () => {
    const demande = await demanderWhatsapp(telephoneParent);
    await http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: demande.jeton })
      .expect(200, { statut: 'EN_ATTENTE' });

    // Le parent a pu retoucher le message : le code est retrouvé quand même.
    await messageRecu(
      telephoneParent,
      `bonjour ${demande.code.toLowerCase()}`,
    ).expect(200);
    expect(whatsapp.reponses.at(-1)).toEqual({
      telephone: telephoneParent,
      texte: expect.stringContaining('confirmée'),
    });

    const { body } = await http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: demande.jeton })
      .expect(200);
    expect(body.utilisateur.role).toBe(Role.PARENT);
    expect(body.jetonAcces).toBeTruthy();

    await http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: demande.jeton })
      .expect(401);
  });

  it('répond pareil pour un numéro inconnu, sans jamais ouvrir de session', async () => {
    const demande = await demanderWhatsapp(autreTelephone);
    await messageRecu(autreTelephone, demande.message).expect(200);
    expect(whatsapp.reponses.at(-1)?.texte).toMatch(/aucune école/);
    await http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: demande.jeton })
      .expect(401);
  });

  it('refuse un jeton de suivi inconnu', () =>
    http()
      .post('/api/auth/whatsapp/suivi')
      .send({ jeton: 'jeton-inconnu' })
      .expect(401));
});
