// Parcours complet d'authentification sur une vraie base PostgreSQL (pnpm db:up && pnpm db:migrate).
// Le test crée ses propres données dans une école dédiée et les supprime à la fin.
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { altcha } from './connexion.js';
import { configurerApplication } from '../src/app.setup.js';
import { Roles } from '../src/auth/decorators/roles.decorator.js';
import { ParentOwnsEleveGuard } from '../src/auth/guards/parent-owns-eleve.guard.js';
import { Genre, LienTuteur, Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SmsSender } from '../src/sms/sms.sender.js';

@Controller('test')
class ControleurTest {
  @Get('eleves/:eleveId')
  @UseGuards(ParentOwnsEleveGuard)
  eleve() {
    return { ok: true };
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  admin() {
    return { ok: true };
  }
}

class SmsCapture extends SmsSender {
  derniers: { telephone: string; message: string }[] = [];
  envoyer(telephone: string, message: string) {
    this.derniers.push({ telephone, message });
    return Promise.resolve();
  }
  dernierCode(): string {
    const code = /\b(\d{6})\b/.exec(this.derniers.at(-1)?.message ?? '')?.[1];
    if (!code) throw new Error('Aucun code reçu');
    return code;
  }
}

describe('Authentification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sms = new SmsCapture();

  const ecoleId = randomUUID();
  const emailPersonnel = `secretariat-${ecoleId}@test.sn`;
  const motDePasse = 'MotDePasse-Test-2026';
  const telephoneParent = `+22170${randomInt(1_000_000, 9_999_999)}`;
  let eleveDuParent: string;
  let autreEleve: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ControleurTest],
    })
      .overrideProvider(SmsSender)
      .useValue(sms)
      .compile();

    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.ecole.create({
      data: { id: ecoleId, nom: 'École de test e2e' },
    });
    await prisma.utilisateur.create({
      data: {
        ecoleId,
        prenoms: 'Coumba',
        nom: 'Test',
        email: emailPersonnel,
        role: Role.SECRETARIAT,
        motDePasseHash: await hash(motDePasse),
      },
    });
    const tuteur = await prisma.tuteur.create({
      data: {
        ecoleId,
        prenoms: 'Astou',
        nom: 'Test',
        contact1: telephoneParent,
      },
    });
    const eleve = (matricule: string) =>
      prisma.eleve.create({
        data: {
          ecoleId,
          matricule,
          prenoms: 'Awa',
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2014-03-01'),
        },
      });
    eleveDuParent = (await eleve(`E2E-${ecoleId}-1`)).id;
    autreEleve = (await eleve(`E2E-${ecoleId}-2`)).id;
    await prisma.eleveTuteur.create({
      data: {
        eleveId: eleveDuParent,
        tuteurId: tuteur.id,
        lien: LienTuteur.MERE,
        principal: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.codeOtp.deleteMany({ where: { telephone: telephoneParent } });
    await prisma.eleve.deleteMany({ where: { ecoleId } });
    await prisma.tuteur.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('personnel : email + mot de passe', () => {
    it('refuse un mauvais mot de passe', () =>
      http()
        .post('/api/auth/connexion')
        .send({ email: emailPersonnel, motDePasse: 'faux', altcha: altcha() })
        .expect(401));

    it('refuse un email inconnu avec le même message', async () => {
      const res = await http()
        .post('/api/auth/connexion')
        .send({
          email: `inconnu-${ecoleId}@test.sn`,
          motDePasse,
          altcha: altcha(),
        })
        .expect(401);
      expect(res.body.message).toBe('Email ou mot de passe incorrect.');
    });

    it('rejette un champ inattendu', () =>
      http()
        .post('/api/auth/connexion')
        .send({
          email: emailPersonnel,
          motDePasse,
          role: 'ADMIN',
          altcha: altcha(),
        })
        .expect(400));

    it('connecte, donne accès à /moi, applique les rôles, puis tourne les jetons', async () => {
      const connexion = await http()
        .post('/api/auth/connexion')
        .send({
          email: emailPersonnel.toUpperCase(),
          motDePasse,
          altcha: altcha(),
        })
        .expect(200);
      const { jetonAcces, jetonRafraichissement } = connexion.body;
      expect(connexion.body.utilisateur.role).toBe(Role.SECRETARIAT);

      await http().get('/api/auth/moi').expect(401);
      const moi = await http()
        .get('/api/auth/moi')
        .set('Authorization', `Bearer ${jetonAcces}`)
        .expect(200);
      expect(moi.body.email).toBe(emailPersonnel);

      await http()
        .get('/api/test/admin')
        .set('Authorization', `Bearer ${jetonAcces}`)
        .expect(403);
      // Le personnel n'est pas concerné par le garde parent.
      await http()
        .get(`/api/test/eleves/${autreEleve}`)
        .set('Authorization', `Bearer ${jetonAcces}`)
        .expect(200);

      const rafraichi = await http()
        .post('/api/auth/rafraichir')
        .send({ jetonRafraichissement })
        .expect(200);
      expect(rafraichi.body.jetonRafraichissement).not.toBe(
        jetonRafraichissement,
      );

      // Réutiliser l'ancien jeton ferme toutes les sessions, y compris la nouvelle.
      await http()
        .post('/api/auth/rafraichir')
        .send({ jetonRafraichissement })
        .expect(401);
      await http()
        .post('/api/auth/rafraichir')
        .send({ jetonRafraichissement: rafraichi.body.jetonRafraichissement })
        .expect(401);
    });

    it('déconnecte : le jeton de rafraîchissement ne sert plus', async () => {
      const { body } = await http()
        .post('/api/auth/connexion')
        .send({ email: emailPersonnel, motDePasse, altcha: altcha() })
        .expect(200);
      await http()
        .post('/api/auth/deconnexion')
        .send({ jetonRafraichissement: body.jetonRafraichissement })
        .expect(204);
      await http()
        .post('/api/auth/rafraichir')
        .send({ jetonRafraichissement: body.jetonRafraichissement })
        .expect(401);
    });
  });

  describe('parents : téléphone + code SMS', () => {
    it('répond pareil pour un numéro inconnu, sans envoyer de SMS', async () => {
      const avant = sms.derniers.length;
      await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: '+221709999999', altcha: altcha() })
        .expect(202);
      expect(sms.derniers.length).toBe(avant);
    });

    it('bloque le code après 3 essais faux', async () => {
      await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: telephoneParent, altcha: altcha() })
        .expect(202);
      const bon = sms.dernierCode();
      const faux = bon === '000000' ? '111111' : '000000';

      for (let i = 0; i < 3; i++) {
        await http()
          .post('/api/auth/otp/verification')
          .send({ telephone: telephoneParent, code: faux })
          .expect(401);
      }
      await http()
        .post('/api/auth/otp/verification')
        .send({ telephone: telephoneParent, code: bon })
        .expect(401);
    });

    it("connecte le parent, qui ne voit que son enfant ; le code ne sert qu'une fois", async () => {
      // Format avec espaces accepté et normalisé.
      const avecEspaces = telephoneParent.replace(/^(\+221)(\d{2})/, '$1 $2 ');
      await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: avecEspaces, altcha: altcha() })
        .expect(202);
      const code = sms.dernierCode();
      expect(sms.derniers.at(-1)?.telephone).toBe(telephoneParent);

      const { body } = await http()
        .post('/api/auth/otp/verification')
        .send({ telephone: telephoneParent, code })
        .expect(200);
      expect(body.utilisateur.role).toBe(Role.PARENT);
      expect(body.utilisateur.tuteurId).toBeTruthy();
      const auth = `Bearer ${body.jetonAcces}`;

      await http()
        .get(`/api/test/eleves/${eleveDuParent}`)
        .set('Authorization', auth)
        .expect(200);
      await http()
        .get(`/api/test/eleves/${autreEleve}`)
        .set('Authorization', auth)
        .expect(403);

      await http()
        .post('/api/auth/otp/verification')
        .send({ telephone: telephoneParent, code })
        .expect(401);
    });

    it('limite les demandes de code à 3 par quart d’heure', async () => {
      // 2 demandes déjà faites plus haut pour ce numéro.
      await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: telephoneParent, altcha: altcha() })
        .expect(202);
      await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: telephoneParent, altcha: altcha() })
        .expect(429);
    });

    it('refuse un numéro mal formé', () =>
      http()
        .post('/api/auth/otp/demande')
        .send({ telephone: '77 123 45 67', altcha: altcha() })
        .expect(400));
  });
});
