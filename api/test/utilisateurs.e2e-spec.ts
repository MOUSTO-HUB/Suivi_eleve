// Comptes du personnel gérés par la direction : création, mot de passe, désactivation.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Comptes du personnel (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  let directionId = '';
  const email = `prof-${randomUUID()}@personnel.test`;
  let profId = '';
  let motDePasse = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    await prisma.ecole.create({ data: { id: ecoleId, nom: 'École comptes' } });
    for (const [cle, role] of [
      ['direction', Role.ADMIN],
      ['secretariat', Role.SECRETARIAT],
    ] as const) {
      const u = await prisma.utilisateur.create({
        data: { ecoleId, prenoms: cle, nom: 'Test', role },
      });
      if (role === Role.ADMIN) directionId = u.id;
      jetons[cle] = jwt.sign({ sub: u.id, role, ecoleId });
    }
  });

  afterAll(async () => {
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const avec = (qui: string) => ({ Authorization: `Bearer ${jetons[qui]}` });
  const connexion = (mdp: string) =>
    http().post('/api/auth/connexion').send({ email, motDePasse: mdp });

  it('crée un compte avec un mot de passe provisoire affiché une fois', async () => {
    const { body } = await http()
      .post('/api/utilisateurs')
      .set(avec('direction'))
      .send({
        prenoms: 'Fatou',
        nom: 'Ndiaye',
        email: email.toUpperCase(),
        role: 'ENSEIGNANT',
      })
      .expect(201);
    expect(body).toMatchObject({ email, role: 'ENSEIGNANT', actif: true });
    expect(body.motDePasseProvisoire).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    expect(body.motDePasseHash).toBeUndefined();
    profId = body.id;
    motDePasse = body.motDePasseProvisoire;

    const liste = await http()
      .get('/api/utilisateurs')
      .set(avec('direction'))
      .expect(200);
    expect(liste.body.map((u: { email: string }) => u.email)).toContain(email);
    expect(liste.body[0].motDePasseProvisoire).toBeUndefined();
  });

  it('refuse un email déjà utilisé, un rôle parent et le secrétariat', async () => {
    await http()
      .post('/api/utilisateurs')
      .set(avec('direction'))
      .send({ prenoms: 'X', nom: 'Y', email, role: 'SURVEILLANT' })
      .expect(409);
    await http()
      .post('/api/utilisateurs')
      .set(avec('direction'))
      .send({
        prenoms: 'X',
        nom: 'Y',
        email: `p-${randomUUID()}@t.test`,
        role: 'PARENT',
      })
      .expect(400);
    await http().get('/api/utilisateurs').set(avec('secretariat')).expect(403);
  });

  it('la personne se connecte puis change son mot de passe', async () => {
    const session = await connexion(motDePasse).expect(200);
    const jeton = { Authorization: `Bearer ${session.body.jetonAcces}` };
    await http()
      .post('/api/utilisateurs/moi/mot-de-passe')
      .set(jeton)
      .send({ actuel: 'faux', nouveau: 'Nouveau-mot-2026' })
      .expect(401);
    const faible = await http()
      .post('/api/utilisateurs/moi/mot-de-passe')
      .set(jeton)
      .send({ actuel: motDePasse, nouveau: 'court1' })
      .expect(400);
    expect(faible.body.message).toContain('au moins 10');
    await http()
      .post('/api/utilisateurs/moi/mot-de-passe')
      .set(jeton)
      .send({ actuel: motDePasse, nouveau: 'Nouveau-mot-2026' })
      .expect(204);
    await connexion(motDePasse).expect(401);
    await connexion('Nouveau-mot-2026').expect(200);
  });

  it('réinitialise le mot de passe et ferme les sessions', async () => {
    const session = await connexion('Nouveau-mot-2026').expect(200);
    const { body } = await http()
      .post(`/api/utilisateurs/${profId}/reinitialiser-mot-de-passe`)
      .set(avec('direction'))
      .expect(200);
    await http()
      .post('/api/auth/rafraichir')
      .send({ jetonRafraichissement: session.body.jetonRafraichissement })
      .expect(401);
    await connexion(body.motDePasseProvisoire).expect(200);
    motDePasse = body.motDePasseProvisoire;
  });

  it('désactive un compte, mais jamais le sien', async () => {
    await http()
      .patch(`/api/utilisateurs/${directionId}`)
      .set(avec('direction'))
      .send({ actif: false })
      .expect(400);
    await http()
      .patch(`/api/utilisateurs/${profId}`)
      .set(avec('direction'))
      .send({ actif: false, role: 'SURVEILLANT' })
      .expect(200);
    await connexion(motDePasse).expect(401);
    expect(
      await prisma.journalAudit.count({
        where: { ecoleId, entite: 'Utilisateur', entiteId: profId },
      }),
    ).toBeGreaterThanOrEqual(3);
  });
});
