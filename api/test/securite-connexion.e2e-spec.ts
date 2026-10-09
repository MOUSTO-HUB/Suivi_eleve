// Protections de la connexion : « Je ne suis pas un robot » (ALTCHA), blocage
// progressif, double authentification (email, application, codes de secours)
// et « mot de passe oublié ».
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import { codeTotp, pasCourant } from '../src/auth/totp.js';
import { Role } from '../src/generated/prisma/enums.js';
import { ENVOIS_SIMULES } from '../src/notifications/fournisseurs/fournisseurs.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { altcha, connecter, dernierCodeEmail } from './connexion.js';

describe('Sécurité de la connexion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: Redis;
  const ecoleId = randomUUID();
  const motDePasse = 'Bon-mot-2026';
  const emails = {
    surveillant: `surveillant-${randomUUID()}@connexion.test`,
    direction: `direction-${randomUUID()}@connexion.test`,
    secretariat: `secretariat-${randomUUID()}@connexion.test`,
    oubli: `oubli-${randomUUID()}@connexion.test`,
  };
  const ids: Record<string, string> = {};
  let jetonDirection = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    await prisma.ecole.create({
      data: { id: ecoleId, nom: 'École connexion' },
    });
    const roles = {
      surveillant: Role.SURVEILLANT,
      direction: Role.ADMIN,
      secretariat: Role.SECRETARIAT,
      oubli: Role.ENSEIGNANT,
    } as const;
    for (const [cle, role] of Object.entries(roles)) {
      const u = await prisma.utilisateur.create({
        data: {
          ecoleId,
          prenoms: cle,
          nom: 'Test',
          role,
          email: emails[cle as keyof typeof emails],
          motDePasseHash: await hash(motDePasse),
        },
      });
      ids[cle] = u.id;
    }
    jetonDirection = app
      .get(JwtService)
      .sign({ sub: ids.direction, role: Role.ADMIN, ecoleId });
  });

  afterAll(async () => {
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await redis.quit();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const essai = (email: string, mdp: string) =>
    http()
      .post('/api/auth/connexion')
      .send({ email, motDePasse: mdp, altcha: altcha() });
  /** Les limites par IP et par compte (15 minutes) ne doivent pas masquer le blocage testé. */
  const oublierLimites = async () => {
    const cles = await redis.keys(`${process.env.BULLMQ_PREFIXE}:limite:*`);
    if (cles.length) await redis.del(...cles);
  };
  /** Fait comme si le blocage en cours était terminé. */
  const finDuBlocage = (id: string) =>
    prisma.utilisateur.update({
      where: { id },
      data: { bloqueJusquA: new Date(Date.now() - 1000) },
    });

  describe('« Je ne suis pas un robot »', () => {
    it('donne un défi ALTCHA', async () => {
      const { body } = await http().get('/api/auth/altcha').expect(200);
      expect(body).toMatchObject({ algorithm: 'SHA-256' });
      expect(body.salt).toMatch(/\?expires=\d+$/);
    });

    it('refuse un formulaire sans réponse, avec une fausse réponse ou une réponse déjà servie', async () => {
      const sans = await http()
        .post('/api/auth/connexion')
        .send({ email: emails.surveillant, motDePasse })
        .expect(400);
      expect(JSON.stringify(sans.body.message)).toContain('robot');
      await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: '+221771234567', altcha: 'faux' })
        .expect(400);
      const reponse = altcha();
      await http()
        .post('/api/auth/mot-de-passe/oubli')
        .send({ email: emails.oubli, altcha: reponse })
        .expect(202);
      const rejoue = await http()
        .post('/api/auth/mot-de-passe/oubli')
        .send({ email: emails.oubli, altcha: reponse })
        .expect(400);
      expect(rejoue.body.message).toContain('robot');
    });
  });

  describe('blocage progressif', () => {
    it('3 erreurs : 30 minutes ; puis 3 heures ; puis compte désactivé, réactivé par la direction', async () => {
      await oublierLimites();
      const email = emails.surveillant;
      await essai(email, 'faux-1').expect(401);
      await essai(email, 'faux-2').expect(401);
      const premier = await essai(email, 'faux-3').expect(429);
      expect(premier.body.message).toBe(
        '3 essais incorrects : compte bloqué pendant 30 minutes.',
      );
      // Même le bon mot de passe est refusé pendant le blocage.
      const pendant = await essai(email, motDePasse).expect(429);
      expect(pendant.body.message).toContain('Réessayez dans 30 minutes');
      expect(
        ENVOIS_SIMULES.some(
          (e) =>
            e.destinataire === email &&
            e.texte.includes('bloqué pendant 30 minutes'),
        ),
      ).toBe(true);

      await finDuBlocage(ids.surveillant);
      await essai(email, 'faux-4').expect(401);
      await essai(email, 'faux-5').expect(401);
      const second = await essai(email, 'faux-6').expect(429);
      expect(second.body.message).toContain('compte bloqué pendant 3 heures');

      await oublierLimites();
      await finDuBlocage(ids.surveillant);
      await essai(email, 'faux-7').expect(401);
      await essai(email, 'faux-8').expect(401);
      const troisieme = await essai(email, 'faux-9').expect(403);
      expect(troisieme.body.message).toContain('désactivé');
      expect(troisieme.body.message).toContain('direction');
      const compte = await prisma.utilisateur.findUniqueOrThrow({
        where: { id: ids.surveillant },
      });
      expect(compte.actif).toBe(false);
      expect(compte.verrouilleLe).not.toBeNull();
      // Le bon mot de passe ne suffit plus.
      await essai(email, motDePasse).expect(403);

      // La direction voit le compte verrouillé et le réactive.
      const liste = await http()
        .get('/api/utilisateurs')
        .set('Authorization', `Bearer ${jetonDirection}`)
        .expect(200);
      expect(
        liste.body.find((u: { id: string }) => u.id === ids.surveillant),
      ).toMatchObject({ actif: false, verrouilleLe: expect.any(String) });
      await http()
        .patch(`/api/utilisateurs/${ids.surveillant}`)
        .set('Authorization', `Bearer ${jetonDirection}`)
        .send({ actif: true })
        .expect(200);
      await essai(email, motDePasse).expect(200);
      const apres = await prisma.utilisateur.findUniqueOrThrow({
        where: { id: ids.surveillant },
      });
      expect(apres).toMatchObject({
        echecsConnexion: 0,
        blocages: 0,
        bloqueJusquA: null,
        verrouilleLe: null,
      });
    });

    it('une connexion réussie remet les essais à zéro', async () => {
      await oublierLimites();
      await essai(emails.surveillant, 'faux').expect(401);
      await essai(emails.surveillant, 'faux').expect(401);
      await essai(emails.surveillant, motDePasse).expect(200);
      await essai(emails.surveillant, 'faux').expect(401);
      await essai(emails.surveillant, 'faux').expect(401);
      await essai(emails.surveillant, motDePasse).expect(200);
    });
  });

  describe('double authentification', () => {
    it('direction : code par email obligatoire, le jeton d’étape n’ouvre rien', async () => {
      await oublierLimites();
      const etape1 = await essai(emails.direction, motDePasse).expect(200);
      expect(etape1.body.jetonAcces).toBeUndefined();
      expect(etape1.body.doubleAuth).toMatchObject({
        methode: 'EMAIL',
        email: expect.stringMatching(/^d•+@connexion\.test$/),
      });
      const { jeton } = etape1.body.doubleAuth;
      await http()
        .get('/api/auth/moi')
        .set('Authorization', `Bearer ${jeton}`)
        .expect(401);
      const code = dernierCodeEmail(emails.direction);
      const faux = code === '000000' ? '111111' : '000000';
      await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton, code: faux })
        .expect(401);
      const session = await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton, code })
        .expect(200);
      expect(session.body.utilisateur.role).toBe('ADMIN');
      // Un code ne sert qu'une fois.
      await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton, code })
        .expect(401);
      // Obligatoire : la direction ne peut pas la retirer.
      const retrait = await http()
        .post('/api/auth/double-auth/desactivation')
        .set('Authorization', `Bearer ${session.body.jetonAcces}`)
        .send({ motDePasse })
        .expect(400);
      expect(retrait.body.message).toContain('obligatoire');
    });

    it('3 codes faux bloquent le compte comme 3 mauvais mots de passe', async () => {
      await oublierLimites();
      // Le code rejoué du test précédent compte déjà pour un essai incorrect.
      await prisma.utilisateur.update({
        where: { id: ids.direction },
        data: { echecsConnexion: 0 },
      });
      const { body } = await essai(emails.direction, motDePasse).expect(200);
      const code = dernierCodeEmail(emails.direction);
      const faux = (n: number) =>
        String((Number(code) + n) % 1_000_000).padStart(6, '0');
      for (const n of [1, 2])
        await http()
          .post('/api/auth/double-auth/verification')
          .send({ jeton: body.doubleAuth.jeton, code: faux(n) })
          .expect(401);
      await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton: body.doubleAuth.jeton, code: faux(3) })
        .expect(429);
      await prisma.utilisateur.update({
        where: { id: ids.direction },
        data: { echecsConnexion: 0, blocages: 0, bloqueJusquA: null },
      });
    });

    it('application d’authentification, codes de secours, puis retrait (rôle non obligé)', async () => {
      await oublierLimites();
      const session = await connecter(http, emails.secretariat, motDePasse);
      const moi = {
        Authorization: `Bearer ${session.body.jetonAcces}`,
      };
      const etat = await http()
        .get('/api/auth/double-auth')
        .set(moi)
        .expect(200);
      expect(etat.body).toEqual({
        methode: null,
        obligatoire: false,
        codesSecoursRestants: 0,
      });

      const prep = await http()
        .post('/api/auth/double-auth/application/preparation')
        .set(moi)
        .expect(200);
      expect(prep.body.lien).toContain('otpauth://totp/Suivi_eleve');
      expect(prep.body.qrCode).toMatch(/^data:image\/png;base64,/);
      const secret: string = prep.body.secret;
      const pas = pasCourant();
      await http()
        .post('/api/auth/double-auth/application')
        .set(moi)
        .send({
          jeton: prep.body.jeton,
          code: codeTotp(secret, pas),
          motDePasse: 'faux',
        })
        .expect(400);
      const activation = await http()
        .post('/api/auth/double-auth/application')
        .set(moi)
        .send({
          jeton: prep.body.jeton,
          code: codeTotp(secret, pas),
          motDePasse,
        })
        .expect(200);
      const codes: string[] = activation.body.codesSecours;
      expect(codes).toHaveLength(10);
      const stocke = await prisma.utilisateur.findUniqueOrThrow({
        where: { id: ids.secretariat },
      });
      expect(stocke.totpSecret).not.toContain(secret);

      // Connexion avec l'application : le code déjà utilisé est refusé, le suivant accepté.
      const etape1 = await essai(emails.secretariat, motDePasse).expect(200);
      expect(etape1.body.doubleAuth.methode).toBe('APPLICATION');
      const { jeton } = etape1.body.doubleAuth;
      await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton, code: codeTotp(secret, pas) })
        .expect(401);
      await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton, code: codeTotp(secret, pas + 1) })
        .expect(200);

      // Téléphone oublié : un code de secours, une seule fois.
      await prisma.utilisateur.update({
        where: { id: ids.secretariat },
        data: { echecsConnexion: 0 },
      });
      const etape1b = await essai(emails.secretariat, motDePasse).expect(200);
      await http()
        .post('/api/auth/double-auth/verification')
        .send({
          jeton: etape1b.body.doubleAuth.jeton,
          code: codes[0].toUpperCase(),
        })
        .expect(200);
      await http()
        .post('/api/auth/double-auth/verification')
        .send({ jeton: etape1b.body.doubleAuth.jeton, code: codes[0] })
        .expect(401);
      const etat2 = await http()
        .get('/api/auth/double-auth')
        .set(moi)
        .expect(200);
      expect(etat2.body).toMatchObject({
        methode: 'APPLICATION',
        codesSecoursRestants: 9,
      });

      await http()
        .post('/api/auth/double-auth/desactivation')
        .set(moi)
        .send({ motDePasse })
        .expect(200);
      const direct = await essai(emails.secretariat, motDePasse).expect(200);
      expect(direct.body.jetonAcces).toBeDefined();
    });
  });

  describe('mot de passe oublié', () => {
    it('même réponse pour un email inconnu, sans envoi', async () => {
      await oublierLimites();
      const avant = ENVOIS_SIMULES.length;
      const { body } = await http()
        .post('/api/auth/mot-de-passe/oubli')
        .send({
          email: `inconnu-${randomUUID()}@connexion.test`,
          altcha: altcha(),
        })
        .expect(202);
      expect(body.message).toContain('Si cette adresse');
      expect(ENVOIS_SIMULES.length).toBe(avant);
    });

    it('lien par email, à usage unique ; les sessions sont fermées', async () => {
      await oublierLimites();
      const ancienne = await connecter(http, emails.oubli, motDePasse);
      await http()
        .post('/api/auth/mot-de-passe/oubli')
        .send({ email: emails.oubli, altcha: altcha() })
        .expect(202);
      const envoi = ENVOIS_SIMULES.findLast(
        (e) => e.destinataire === emails.oubli && e.texte.includes('jeton='),
      );
      const jeton = /jeton=([\w-]+)/.exec(envoi!.texte)![1];
      expect(envoi!.texte).toContain('/mot-de-passe/nouveau?jeton=');

      const faible = await http()
        .post('/api/auth/mot-de-passe/reinitialisation')
        .send({ jeton, nouveau: 'court' })
        .expect(400);
      expect(faible.body.message).toContain('au moins 10');
      await http()
        .post('/api/auth/mot-de-passe/reinitialisation')
        .send({ jeton, nouveau: 'Nouveau-mot-2026' })
        .expect(204);
      const rejoue = await http()
        .post('/api/auth/mot-de-passe/reinitialisation')
        .send({ jeton, nouveau: 'Autre-mot-2026' })
        .expect(400);
      expect(rejoue.body.message).toContain('Lien invalide ou expiré');

      await http()
        .post('/api/auth/rafraichir')
        .send({ jetonRafraichissement: ancienne.body.jetonRafraichissement })
        .expect(401);
      await essai(emails.oubli, motDePasse).expect(401);
      await essai(emails.oubli, 'Nouveau-mot-2026').expect(200);
      expect(
        ENVOIS_SIMULES.some(
          (e) =>
            e.destinataire === emails.oubli &&
            e.texte.includes("vient d'être changé"),
        ),
      ).toBe(true);
    });
  });
});
