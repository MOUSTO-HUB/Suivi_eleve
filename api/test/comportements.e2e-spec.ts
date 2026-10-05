// Comportements marquants : signalement, validation des cas graves, messages aux familles.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import { Genre, LienTuteur, Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.BULLMQ_PREFIXE = `e2e-comportements-${randomUUID()}`;

describe('Comportements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  let awa: string;
  let ali: string;
  let tuteurAwa: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    await prisma.ecole.create({
      data: { id: ecoleId, nom: 'École des comportements' },
    });
    const annee = await prisma.anneeScolaire.create({
      data: {
        ecoleId,
        libelle: '2026-2027',
        dateDebut: new Date('2026-10-01'),
        dateFin: new Date('2027-07-15'),
        active: true,
      },
    });
    const classe = await prisma.classe.create({
      data: { ecoleId, anneeScolaireId: annee.id, nom: '3e A', niveau: '3e' },
    });
    const eleve = async (prenoms: string) => {
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `COMP-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2011-03-03'),
          classeId: classe.id,
          tuteurs: {
            create: {
              lien: LienTuteur.MERE,
              principal: true,
              tuteur: {
                create: {
                  ecoleId,
                  prenoms: `Parent ${prenoms}`,
                  nom: 'Test',
                  contact1: `+22176${randomInt(1_000_000, 9_999_999)}`.replace(
                    /0$/,
                    '1',
                  ),
                },
              },
            },
          },
        },
        include: { tuteurs: true },
      });
      return { id: e.id, tuteurId: e.tuteurs[0].tuteurId };
    };
    const a = await eleve('Awa');
    awa = a.id;
    tuteurAwa = a.tuteurId;
    ali = (await eleve('Ali')).id;

    for (const [cle, role] of [
      ['admin', Role.ADMIN],
      ['enseignant', Role.ENSEIGNANT],
      ['comptable', Role.COMPTABLE],
    ] as const) {
      const u = await prisma.utilisateur.create({
        data: { ecoleId, prenoms: cle, nom: 'Test', role },
      });
      jetons[cle] = jwt.sign({ sub: u.id, role, ecoleId });
    }
    const parent = await prisma.utilisateur.create({
      data: {
        ecoleId,
        prenoms: 'Parent',
        nom: 'Awa',
        role: Role.PARENT,
        tuteur: { connect: { id: tuteurAwa } },
      },
    });
    jetons.parent = jwt.sign({
      sub: parent.id,
      role: Role.PARENT,
      ecoleId,
      tuteurId: tuteurAwa,
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { ecoleId } });
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.eleve.deleteMany({ where: { ecoleId } });
    await prisma.tuteur.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.classe.deleteMany({ where: { ecoleId } });
    await prisma.anneeScolaire.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const avec = (qui: string) => ({ Authorization: `Bearer ${jetons[qui]}` });
  const sms = (sourceId: string) =>
    prisma.notification.findFirst({ where: { sourceId, canal: 'SMS' } });
  const demain10h = () => {
    const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    d.setUTCHours(10, 0, 0, 0);
    return d;
  };

  it('prévient la famille aussitôt pour un cas ordinaire', async () => {
    const convocation = demain10h();
    const { body } = await http()
      .post('/api/comportements')
      .set(avec('enseignant'))
      .send({
        eleveId: awa,
        type: 'NEGATIF',
        categorie: 'INDISCIPLINE',
        gravite: 2,
        description: 'Bavardages répétés malgré les avertissements',
        sanction: 'Une heure de retenue',
        convocationLe: convocation.toISOString(),
      })
      .expect(201);
    expect(body).toMatchObject({
      statut: 'VALIDE',
      gravite: 2,
      auteur: { role: 'ENSEIGNANT' },
    });

    const message = await sms(body.id);
    const jour = convocation
      .toISOString()
      .slice(0, 10)
      .split('-')
      .reverse()
      .join('/');
    expect(message!.contenu).toMatch(
      new RegExp(
        `^Suivi_eleve : Awa : indiscipline le \\d\\d/\\d\\d\\. Convocation des parents le ${jour} à 10h00\\.$`,
      ),
    );
    expect(message!.priorite).toBe('HAUTE');
    const historique = await prisma.notification.findFirstOrThrow({
      where: { sourceId: body.id, canal: 'APPLICATION' },
    });
    expect(historique.contenu).toContain('Sanction : Une heure de retenue.');
  });

  it('attend la direction pour un cas grave, puis prévient la famille', async () => {
    const { body } = await http()
      .post('/api/comportements')
      .set(avec('enseignant'))
      .send({
        eleveId: ali,
        type: 'NEGATIF',
        categorie: 'VIOLENCE',
        gravite: 3,
        description: 'Bagarre dans la cour',
      })
      .expect(201);
    expect(body.statut).toBe('EN_ATTENTE');
    expect(await sms(body.id)).toBeNull();

    const liste = await http()
      .get('/api/comportements?statut=EN_ATTENTE')
      .set(avec('admin'))
      .expect(200);
    expect(liste.body).toMatchObject({ total: 1, aValider: 1 });

    await http()
      .post(`/api/comportements/${body.id}/valider`)
      .set(avec('enseignant'))
      .expect(403);
    const valide = await http()
      .post(`/api/comportements/${body.id}/valider`)
      .set(avec('admin'))
      .expect(200);
    expect(valide.body).toMatchObject({
      statut: 'VALIDE',
      validePar: { prenoms: 'admin' },
    });
    expect((await sms(body.id))!.contenu).toMatch(
      /^Suivi_eleve : Ali : violence le/,
    );
    await http()
      .post(`/api/comportements/${body.id}/valider`)
      .set(avec('admin'))
      .expect(400);
  });

  it('peut refuser un cas grave : rien ne part', async () => {
    const { body } = await http()
      .post('/api/comportements')
      .set(avec('enseignant'))
      .send({
        eleveId: ali,
        type: 'NEGATIF',
        categorie: 'FRAUDE',
        gravite: 3,
        description: 'Antisèche',
      })
      .expect(201);
    const rejete = await http()
      .post(`/api/comportements/${body.id}/rejeter`)
      .set(avec('admin'))
      .send({ motif: 'Faits non établis' })
      .expect(200);
    expect(rejete.body).toMatchObject({
      statut: 'REJETE',
      motifRejet: 'Faits non établis',
    });
    expect(await sms(body.id)).toBeNull();
  });

  it('envoie des félicitations, sans sanction ni convocation', async () => {
    const { body } = await http()
      .post('/api/comportements')
      .set(avec('enseignant'))
      .send({
        eleveId: awa,
        type: 'POSITIF',
        categorie: 'FELICITATIONS',
        description: 'Première au concours de lecture',
        sanction: 'ignorée',
      })
      .expect(201);
    expect(body).toMatchObject({
      statut: 'VALIDE',
      sanction: null,
      convocationLe: null,
    });
    expect((await sms(body.id))!.contenu).toMatch(
      /^Suivi_eleve : Félicitations pour Awa le/,
    );
  });

  it.each([
    ['catégorie incohérente', { type: 'POSITIF', categorie: 'VIOLENCE' }],
    ['négatif sans gravité', { type: 'NEGATIF', categorie: 'RETARD' }],
    [
      'convocation passée',
      {
        type: 'NEGATIF',
        categorie: 'RETARD',
        gravite: 1,
        convocationLe: '2020-01-01T10:00:00Z',
      },
    ],
    [
      'sans description',
      { type: 'NEGATIF', categorie: 'RETARD', gravite: 1, description: '' },
    ],
  ])('refuse : %s', async (_, corps) => {
    await http()
      .post('/api/comportements')
      .set(avec('enseignant'))
      .send({ eleveId: awa, description: 'Faits', ...corps })
      .expect(400);
  });

  it('réserve le signalement au personnel éducatif', async () => {
    await http()
      .post('/api/comportements')
      .set(avec('comptable'))
      .send({
        eleveId: awa,
        type: 'POSITIF',
        categorie: 'ENCOURAGEMENT',
        description: 'Bien',
      })
      .expect(403);
  });

  it('montre au parent les comportements validés de son enfant seulement', async () => {
    const { body } = await http()
      .get('/api/comportements')
      .set(avec('parent'))
      .expect(200);
    expect(body.total).toBe(2);
    expect(body.aValider).toBe(0);
    expect(
      body.elements.every(
        (c: { eleve: { prenoms: string } }) => c.eleve.prenoms === 'Awa',
      ),
    ).toBe(true);

    const convocations = await http()
      .get('/api/comportements?convocations=true')
      .set(avec('admin'))
      .expect(200);
    expect(convocations.body.total).toBe(1);
  });
});
