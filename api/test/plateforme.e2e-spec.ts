// Espace concepteur : écoles, abonnements, suspension (connexions et envois bloqués).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import { Genre, LienTuteur, Role } from '../src/generated/prisma/enums.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.BULLMQ_PREFIXE = `e2e-plateforme-${randomUUID()}`;

/** Jour (AAAA-MM-JJ) décalé de n jours par rapport à aujourd'hui. */
const jour = (decalage = 0) =>
  new Date(Date.now() + decalage * 24 * 3600 * 1000).toISOString().slice(0, 10);

describe('Espace concepteur (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emailConcepteur = `concepteur-${randomUUID()}@plateforme.test`;
  const emailDirection = `direction-${randomUUID()}@plateforme.test`;
  const ecoles: string[] = [];
  let concepteurId = '';
  let jetonConcepteur = '';
  let ecoleId = '';
  let motDePasseDirection = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const concepteur = await prisma.utilisateur.create({
      data: {
        ecoleId: null,
        prenoms: 'Concepteur',
        nom: 'Test',
        email: emailConcepteur,
        role: Role.SUPER_ADMIN,
        motDePasseHash: await hash('Concepteur-2026'),
      },
    });
    concepteurId = concepteur.id;
  });

  afterAll(async () => {
    const ou = { ecoleId: { in: ecoles } };
    await prisma.journalAudit.deleteMany({
      where: { OR: [ou, { utilisateurId: concepteurId }] },
    });
    await prisma.notification.deleteMany({ where: ou });
    await prisma.paiementAbonnement.deleteMany({ where: ou });
    await prisma.rappelPaiement.deleteMany({
      where: { eleve: { ecoleId: { in: ecoles } } },
    });
    await prisma.eleve.deleteMany({ where: ou });
    await prisma.tuteur.deleteMany({ where: ou });
    await prisma.utilisateur.deleteMany({
      where: { OR: [ou, { id: concepteurId }] },
    });
    await prisma.periode.deleteMany({
      where: { anneeScolaire: { ecoleId: { in: ecoles } } },
    });
    await prisma.anneeScolaire.deleteMany({ where: ou });
    await prisma.ecole.deleteMany({ where: { id: { in: ecoles } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const commeConcepteur = () => ({
    Authorization: `Bearer ${jetonConcepteur}`,
  });
  const connexionDirection = () =>
    http()
      .post('/api/auth/connexion')
      .send({ email: emailDirection, motDePasse: motDePasseDirection });

  it('connecte le concepteur, sans école', async () => {
    const { body } = await http()
      .post('/api/auth/connexion')
      .send({ email: emailConcepteur, motDePasse: 'Concepteur-2026' })
      .expect(200);
    expect(body.utilisateur).toMatchObject({
      role: 'SUPER_ADMIN',
      ecoleId: '',
    });
    jetonConcepteur = body.jetonAcces;
    await http().get('/api/auth/moi').set(commeConcepteur()).expect(200);
  });

  it('crée une école, son année et sa direction, avec 1 mois d’essai', async () => {
    await http()
      .post('/api/plateforme/ecoles')
      .set(commeConcepteur())
      .send({
        nom: 'École',
        pays: 'FR',
        directionPrenoms: 'A',
        directionNom: 'B',
        directionEmail: 'x@y.z',
      })
      .expect(400);

    const { body } = await http()
      .post('/api/plateforme/ecoles')
      .set(commeConcepteur())
      .send({
        nom: 'Groupe scolaire Kaloum',
        pays: 'GN',
        telephone: '+224 621 00 00 00',
        directionPrenoms: 'Mariama',
        directionNom: 'Barry',
        directionEmail: emailDirection,
      })
      .expect(201);
    ecoleId = body.id;
    ecoles.push(ecoleId);
    motDePasseDirection = body.compteDirection.motDePasseProvisoire;
    expect(body).toMatchObject({
      pays: 'GN',
      telephone: '+224621000000',
      finAbonnement: jour(29),
      abonnement: { etat: 'ESSAI', essai: true, joursRestants: 29 },
      eleves: 0,
      direction: [{ email: emailDirection }],
    });
    const annee = await prisma.anneeScolaire.findFirstOrThrow({
      where: { ecoleId },
      include: { periodes: true },
    });
    expect(annee.active).toBe(true);
    expect(annee.periodes).toHaveLength(3);

    // Même email de direction : refusé.
    await http()
      .post('/api/plateforme/ecoles')
      .set(commeConcepteur())
      .send({
        nom: 'Autre',
        pays: 'SN',
        directionPrenoms: 'X',
        directionNom: 'Y',
        directionEmail: emailDirection,
      })
      .expect(409);
  });

  it('la direction se connecte et voit son abonnement, pas l’espace concepteur', async () => {
    const { body } = await connexionDirection().expect(200);
    const direction = { Authorization: `Bearer ${body.jetonAcces}` };
    const abonnement = await http()
      .get('/api/abonnement')
      .set(direction)
      .expect(200);
    expect(abonnement.body).toMatchObject({
      abonnement: { etat: 'ESSAI' },
      tarifs: { MENSUEL: 150000, ANNUEL: 1500000 },
      paiements: [],
    });
    await http()
      .get('/api/plateforme/tableau-de-bord')
      .set(direction)
      .expect(403);
    // Le concepteur ne lit pas les élèves d'une école.
    await http().get('/api/eleves').set(commeConcepteur()).expect(403);
  });

  it('enregistre un paiement annuel puis l’annule', async () => {
    await http()
      .post(`/api/plateforme/ecoles/${ecoleId}/paiements`)
      .set(commeConcepteur())
      .send({ formule: 'ANNUEL', moyen: 'ORANGE_MONEY', payeLe: jour(1) })
      .expect(400);

    const { body } = await http()
      .post(`/api/plateforme/ecoles/${ecoleId}/paiements`)
      .set(commeConcepteur())
      .send({
        formule: 'ANNUEL',
        moyen: 'ORANGE_MONEY',
        reference: 'OM-123',
        payeLe: jour(),
      })
      .expect(201);
    const [paiement] = body.paiements;
    expect(paiement).toMatchObject({
      formule: 'ANNUEL',
      montant: 1_500_000,
      periodeDebut: jour(30),
    });
    expect(body.abonnement).toMatchObject({ etat: 'ACTIF', essai: false });
    expect(body.finAbonnement).toBe(paiement.periodeFin);

    const tableau = await http()
      .get('/api/plateforme/tableau-de-bord')
      .set(commeConcepteur())
      .expect(200);
    expect(tableau.body.encaissements.annee).toBeGreaterThanOrEqual(1_500_000);
    expect(tableau.body.ecoles.total).toBeGreaterThanOrEqual(1);

    const annule = await http()
      .delete(`/api/plateforme/ecoles/${ecoleId}/paiements/${paiement.id}`)
      .set(commeConcepteur())
      .expect(200);
    expect(annule.body).toMatchObject({
      finAbonnement: jour(29),
      paiements: [],
      abonnement: { etat: 'ESSAI' },
    });
  });

  it('suspend une école : plus de connexion ni d’envoi, puis réactive', async () => {
    // Une famille, pour vérifier que les messages ne partent plus.
    const contact = `+22462${randomInt(1_000_000, 9_999_999)}`;
    await prisma.eleve.create({
      data: {
        ecoleId,
        matricule: `PLAT-${randomUUID()}`,
        prenoms: 'Fanta',
        nom: 'Camara',
        genre: Genre.FEMININ,
        dateNaissance: new Date('2014-03-01'),
        tuteurs: {
          create: {
            lien: LienTuteur.MERE,
            principal: true,
            tuteur: {
              create: {
                ecoleId,
                prenoms: 'Aïssata',
                nom: 'Camara',
                contact1: contact,
              },
            },
          },
        },
      },
    });
    const notifications = app.get(NotificationsService);
    const prevenir = () =>
      notifications.notifier({
        ecoleId,
        type: 'LIBERATION_ANTICIPEE',
        cible: { ecole: true },
        variables: { heure: '11h00', motif: 'test' },
      });

    await http()
      .post(`/api/plateforme/ecoles/${ecoleId}/suspendre`)
      .set(commeConcepteur())
      .send({ motif: 'Abonnement impayé' })
      .expect(200);
    const refus = await connexionDirection().expect(403);
    expect(refus.body.message).toContain('suspendu');
    expect(await prevenir()).toEqual({ tuteurs: 0, envois: 0 });
    // Pas de code SMS pour les parents de cette école (réponse identique).
    await http()
      .post('/api/auth/otp/demande')
      .send({ telephone: contact })
      .expect(202);
    expect(await prisma.codeOtp.count({ where: { telephone: contact } })).toBe(
      0,
    );

    await http()
      .post(`/api/plateforme/ecoles/${ecoleId}/reactiver`)
      .set(commeConcepteur())
      .expect(200);
    await connexionDirection().expect(200);
    expect((await prevenir()).tuteurs).toBe(1);
  });

  it('suspend tout seul après 15 jours de retard', async () => {
    await prisma.ecole.update({
      where: { id: ecoleId },
      data: { finAbonnement: new Date(`${jour(-15)}T00:00:00Z`) },
    });
    await connexionDirection().expect(200); // dernier jour de grâce
    await prisma.ecole.update({
      where: { id: ecoleId },
      data: { finAbonnement: new Date(`${jour(-16)}T00:00:00Z`) },
    });
    await connexionDirection().expect(403);

    // Un paiement mensuel la rétablit, à partir du jour du paiement.
    const { body } = await http()
      .post(`/api/plateforme/ecoles/${ecoleId}/paiements`)
      .set(commeConcepteur())
      .send({ formule: 'MENSUEL', moyen: 'ESPECES', payeLe: jour() })
      .expect(201);
    expect(body.paiements[0]).toMatchObject({
      montant: 150_000,
      periodeDebut: jour(),
    });
    expect(body.abonnement.etat).toBe('ACTIF');
    await connexionDirection().expect(200);
  });

  it('redonne un mot de passe provisoire à la direction', async () => {
    const detail = await http()
      .get(`/api/plateforme/ecoles/${ecoleId}`)
      .set(commeConcepteur())
      .expect(200);
    const [direction] = detail.body.direction;
    const { body } = await http()
      .post(
        `/api/plateforme/ecoles/${ecoleId}/direction/${direction.id}/reinitialiser`,
      )
      .set(commeConcepteur())
      .expect(200);
    await connexionDirection().expect(401);
    motDePasseDirection = body.motDePasseProvisoire;
    await connexionDirection().expect(200);
  });

  it('parle la monnaie et l’indicatif du pays de l’école (Guinée)', async () => {
    const { body } = await connexionDirection().expect(200);
    const direction = { Authorization: `Bearer ${body.jetonAcces}` };
    const profil = await http().get('/api/auth/moi').set(direction).expect(200);
    expect(profil.body.ecole).toMatchObject({
      nom: 'Groupe scolaire Kaloum',
      pays: 'GN',
      monnaie: 'GNF',
      indicatif: '224',
    });

    const fanta = await prisma.eleve.findFirstOrThrow({
      where: { ecoleId, prenoms: 'Fanta' },
    });
    const rappel = await http()
      .post('/api/rappels-paiement')
      .set(direction)
      .send({
        eleveId: fanta.id,
        libelle: 'Frais de cantine',
        montant: 250000,
        dateEcheance: jour(5),
      })
      .expect(201);
    const sms = await prisma.notification.findFirstOrThrow({
      where: { sourceId: rappel.body.id, canal: 'SMS' },
    });
    expect(sms.contenu).toContain('250 000 GNF');
    expect(sms.contenu).not.toContain('FCFA');
  });

  it('n’affiche pas les actions du concepteur dans le journal de l’école', async () => {
    const { body } = await connexionDirection().expect(200);
    const journal = await http()
      .get('/api/audit?parPage=100')
      .set({ Authorization: `Bearer ${body.jetonAcces}` })
      .expect(200);
    const roles = (
      journal.body.elements as { utilisateur: { role: string } | null }[]
    ).map((l) => l.utilisateur?.role);
    expect(roles).toContain('ADMIN');
    expect(roles).not.toContain('SUPER_ADMIN');
    // Elles restent enregistrées pour l'école concernée.
    expect(
      await prisma.journalAudit.count({
        where: { ecoleId, utilisateurId: concepteurId },
      }),
    ).toBeGreaterThan(0);
  });
});
