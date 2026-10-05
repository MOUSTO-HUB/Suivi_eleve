// Rappels de paiement : montant et date normale saisis par le comptable, retard calculé.
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

process.env.BULLMQ_PREFIXE = `e2e-paiements-${randomUUID()}`;

/** Date (AAAA-MM-JJ) décalée de n jours par rapport à aujourd'hui. */
const jour = (decalage: number) =>
  new Date(Date.now() + decalage * 24 * 3600 * 1000).toISOString().slice(0, 10);
const jourFr = (j: string) => j.split('-').reverse().join('/');

describe('Rappels de paiement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  let awa: string;
  let ali: string;

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
      data: { id: ecoleId, nom: 'École des paiements' },
    });
    const eleve = async (prenoms: string) => {
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `PAI-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2012-01-01'),
          tuteurs: {
            create: {
              lien: LienTuteur.MERE,
              principal: true,
              tuteur: {
                create: {
                  ecoleId,
                  prenoms: `Parent ${prenoms}`,
                  nom: 'Test',
                  contact1: `+22177${randomInt(1_000_000, 9_999_999)}`.replace(
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
      return e;
    };
    const a = await eleve('Awa');
    awa = a.id;
    ali = (await eleve('Ali')).id;
    for (const [cle, role] of [
      ['comptable', Role.COMPTABLE],
      ['enseignant', Role.ENSEIGNANT],
      ['secretariat', Role.SECRETARIAT],
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
        tuteur: { connect: { id: a.tuteurs[0].tuteurId } },
      },
    });
    jetons.parent = jwt.sign({
      sub: parent.id,
      role: Role.PARENT,
      ecoleId,
      tuteurId: a.tuteurs[0].tuteurId,
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { ecoleId } });
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.eleve.deleteMany({ where: { ecoleId } });
    await prisma.tuteur.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const avec = (qui: string) => ({ Authorization: `Bearer ${jetons[qui]}` });
  const sms = (sourceId: string) =>
    prisma.notification.findMany({
      where: { sourceId, canal: 'SMS' },
      orderBy: { creeLe: 'asc' },
    });

  let octobre: { id: string };

  it('signale un retard : la famille reçoit le montant et le retard calculé', async () => {
    const echeance = jour(-35);
    const { body } = await http()
      .post('/api/rappels-paiement')
      .set(avec('comptable'))
      .send({
        eleveId: awa,
        libelle: "Mensualité d'octobre",
        montant: 25000,
        dateEcheance: echeance,
      })
      .expect(201);
    octobre = body;
    expect(body).toMatchObject({
      statut: 'EN_COURS',
      joursRetard: 35,
      nombreEnvois: 1,
      famillesPrevenues: 1,
      dateEcheance: echeance,
    });
    const [message] = await sms(body.id);
    expect(message.type).toBe('RETARD_PAIEMENT');
    expect(message.contenu).toBe(
      `Suivi_eleve : mensualité d'octobre de Awa (25 000 FCFA) à régler depuis le ${jourFr(echeance)} : 35 jours de retard. Merci de régulariser.`,
    );
  });

  it("envoie un simple rappel quand la date n'est pas encore passée", async () => {
    const { body } = await http()
      .post('/api/rappels-paiement')
      .set(avec('comptable'))
      .send({
        eleveId: awa,
        libelle: 'Frais de sortie',
        montant: 5000,
        dateEcheance: jour(5),
      })
      .expect(201);
    expect(body.joursRetard).toBe(0);
    const [message] = await sms(body.id);
    expect(message.type).toBe('RAPPEL_PAIEMENT');
    expect(message.contenu).toBe(
      `Suivi_eleve : rappel, frais de sortie de Awa : 5 000 FCFA à régler avant le ${jourFr(jour(5))}.`,
    );
    // L'email signale le total des sommes en attente pour l'élève.
    const historique = await prisma.notification.findFirstOrThrow({
      where: { sourceId: body.id, canal: 'APPLICATION' },
    });
    expect(historique.contenu).toContain(
      'Au total, 30 000 FCFA restent en attente pour cet élève (2 paiements).',
    );
  });

  it('relance avec le retard du jour, puis cesse une fois réglé', async () => {
    const relance = await http()
      .post(`/api/rappels-paiement/${octobre.id}/relancer`)
      .set(avec('comptable'))
      .expect(200);
    expect(relance.body).toMatchObject({
      nombreEnvois: 2,
      famillesPrevenues: 1,
    });
    expect(await sms(octobre.id)).toHaveLength(2);

    const regle = await http()
      .post(`/api/rappels-paiement/${octobre.id}/regler`)
      .set(avec('comptable'))
      .expect(200);
    expect(regle.body).toMatchObject({ statut: 'REGLE', joursRetard: 0 });
    await http()
      .post(`/api/rappels-paiement/${octobre.id}/relancer`)
      .set(avec('comptable'))
      .expect(400);
  });

  it.each([
    ['montant nul', { montant: 0 }],
    ['montant décimal', { montant: 12.5 }],
    ['date impossible', { dateEcheance: '2026-02-30' }],
    ['date trop ancienne', { dateEcheance: '2020-01-01' }],
    ['sans libellé', { libelle: '' }],
  ])('refuse : %s', async (_, corps) => {
    await http()
      .post('/api/rappels-paiement')
      .set(avec('comptable'))
      .send({
        eleveId: ali,
        libelle: 'Mensualité',
        montant: 25000,
        dateEcheance: jour(-3),
        ...corps,
      })
      .expect(400);
  });

  it('réserve la saisie au comptable et à la direction', async () => {
    await http()
      .post('/api/rappels-paiement')
      .set(avec('enseignant'))
      .send({
        eleveId: ali,
        libelle: 'Mensualité',
        montant: 25000,
        dateEcheance: jour(-3),
      })
      .expect(403);
    await http()
      .post('/api/rappels-paiement')
      .set(avec('secretariat'))
      .send({
        eleveId: ali,
        libelle: 'Mensualité',
        montant: 25000,
        dateEcheance: jour(-3),
      })
      .expect(403);
    await http()
      .get('/api/rappels-paiement')
      .set(avec('enseignant'))
      .expect(403);
  });

  it('donne la liste avec le total en attente ; le parent voit les siens en cours', async () => {
    await http()
      .post('/api/rappels-paiement')
      .set(avec('comptable'))
      .send({
        eleveId: ali,
        libelle: 'Mensualité de novembre',
        montant: 25000,
        dateEcheance: jour(-3),
      })
      .expect(201);

    const tout = await http()
      .get('/api/rappels-paiement')
      .set(avec('secretariat'))
      .expect(200);
    expect(tout.body.total).toBe(3);
    expect(tout.body.enAttente).toEqual({ montant: 30000, eleves: 2 });

    const parent = await http()
      .get('/api/rappels-paiement')
      .set(avec('parent'))
      .expect(200);
    expect(
      parent.body.elements.map((r: { libelle: string }) => r.libelle),
    ).toEqual(['Frais de sortie']);
    await http()
      .post(`/api/rappels-paiement/${parent.body.elements[0].id}/regler`)
      .set(avec('parent'))
      .expect(403);
  });
});
