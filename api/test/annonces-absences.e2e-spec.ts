// Absence de cours, libération anticipée et absences d'élèves (PostgreSQL + Redis, envois simulés).
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

process.env.BULLMQ_PREFIXE = `e2e-annonces-${randomUUID()}`;

async function attendre<T>(
  lire: () => Promise<T>,
  ok: (v: T) => boolean,
  ms = 15_000,
): Promise<T> {
  const fin = Date.now() + ms;
  for (;;) {
    const valeur = await lire();
    if (ok(valeur)) return valeur;
    if (Date.now() > fin)
      throw new Error(`Délai dépassé : ${JSON.stringify(valeur)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const aujourdHui = () => new Date().toISOString().slice(0, 10);

describe('Annonces et absences (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  let classeA: string;
  let classeB: string;
  const eleves: Record<string, string> = {};
  const tuteurs: Record<string, string> = {};

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
      data: { id: ecoleId, nom: 'École des annonces' },
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
    const classe = (nom: string) =>
      prisma.classe.create({
        data: { ecoleId, anneeScolaireId: annee.id, nom, niveau: '5e' },
      });
    classeA = (await classe('5e A')).id;
    classeB = (await classe('5e B')).id;

    for (const [prenoms, classeId] of [
      ['Awa', classeA],
      ['Ali', classeA],
      ['Khady', classeB],
    ] as const) {
      const t = await prisma.tuteur.create({
        data: {
          ecoleId,
          prenoms: `Parent de ${prenoms}`,
          nom: 'Test',
          contact1: `+22178${randomInt(1_000_000, 9_999_999)}`.replace(
            /0$/,
            '1',
          ),
        },
      });
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `ANN-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2013-01-01'),
          classeId,
          tuteurs: {
            create: { tuteurId: t.id, lien: LienTuteur.MERE, principal: true },
          },
        },
      });
      eleves[prenoms] = e.id;
      tuteurs[prenoms] = t.id;
    }

    const utilisateur = async (cle: string, role: Role, tuteurId?: string) => {
      const u = await prisma.utilisateur.create({
        data: {
          ecoleId,
          prenoms: cle,
          nom: 'Test',
          role,
          ...(tuteurId ? { tuteur: { connect: { id: tuteurId } } } : {}),
        },
      });
      jetons[cle] = jwt.sign({
        sub: u.id,
        role,
        ecoleId,
        ...(tuteurId ? { tuteurId } : {}),
      });
    };
    await utilisateur('secretariat', Role.SECRETARIAT);
    await utilisateur('enseignant', Role.ENSEIGNANT);
    await utilisateur('surveillant', Role.SURVEILLANT);
    await utilisateur('parentAwa', Role.PARENT, tuteurs.Awa);
    await utilisateur('parentKhady', Role.PARENT, tuteurs.Khady);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { ecoleId } });
    await prisma.annonce.deleteMany({ where: { ecoleId } });
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

  describe('annonces', () => {
    it('libère une classe tout de suite, en urgence, et suit les lectures', async () => {
      const { body } = await http()
        .post('/api/annonces')
        .set(avec('secretariat'))
        .send({
          type: 'LIBERATION_ANTICIPEE',
          cible: 'CLASSES',
          classeIds: [classeA],
          date: aujourdHui(),
          heure: '11:30',
          motif: 'COUPURE_ELECTRICITE',
          message: 'Le portail ouvre à 11h15.',
        })
        .expect(201);
      expect(body).toMatchObject({
        statut: 'ENVOYEE',
        titre: 'Libération anticipée à 11h30 – 5e A',
        classes: [{ id: classeA, nom: '5e A' }],
        suivi: { familles: 2, lues: 0 },
      });

      const sms = await attendre(
        () =>
          prisma.notification.findMany({
            where: { sourceId: body.id, canal: 'SMS' },
          }),
        (l) => l.length === 2 && l.every((n) => n.statut === 'ENVOYEE'),
      );
      expect(sms[0].priorite).toBe('URGENTE');
      expect(sms[0].contenu).toBe(
        "Suivi_eleve : les élèves de 5e A sont libérés à 11h30 (coupure d'électricité). Merci de prendre vos dispositions.",
      );
      const historique = await prisma.notification.findFirstOrThrow({
        where: {
          sourceId: body.id,
          canal: 'APPLICATION',
          tuteurId: tuteurs.Awa,
        },
      });
      expect(historique.contenu).toContain('Le portail ouvre à 11h15.');

      // Le parent lit : le suivi le montre.
      await http()
        .post(`/api/notifications/${historique.id}/lue`)
        .set(avec('parentAwa'))
        .expect(200);
      const suivi = await http()
        .get(`/api/annonces/${body.id}`)
        .set(avec('secretariat'))
        .expect(200);
      expect(suivi.body.suivi).toMatchObject({
        familles: 2,
        lues: 1,
        enCours: false,
      });
      expect(suivi.body.suivi.parCanal.SMS).toEqual({ ENVOYEE: 2 });
      expect(
        suivi.body.suivi.nonLues.map(
          (n: { eleve: { prenoms: string } }) => n.eleve.prenoms,
        ),
      ).toEqual(['Ali']);
    });

    it('programme une absence de cours puis l’envoie à l’heure dite', async () => {
      const { body } = await http()
        .post('/api/annonces')
        .set(avec('secretariat'))
        .send({
          type: 'PAS_DE_COURS',
          cible: 'ECOLE',
          date: '2026-12-01',
          creneau: 'toute la journée',
          motif: 'AUTRE',
          motifDetail: 'formation des enseignants',
          programmeeLe: new Date(Date.now() + 61_000).toISOString(),
        })
        .expect(201);
      expect(body).toMatchObject({
        statut: 'PROGRAMMEE',
        suivi: { familles: 0 },
      });
      expect(
        await prisma.notification.count({ where: { sourceId: body.id } }),
      ).toBe(0);

      // « Envoyer maintenant » plutôt que d'attendre la minute.
      const envoye = await http()
        .post(`/api/annonces/${body.id}/envoyer`)
        .set(avec('secretariat'))
        .expect(200);
      expect(envoye.body).toMatchObject({
        statut: 'ENVOYEE',
        suivi: { familles: 3 },
      });
      const sms = await prisma.notification.findFirstOrThrow({
        where: { sourceId: body.id, canal: 'SMS', tuteurId: tuteurs.Khady },
      });
      expect(sms.contenu).toBe(
        'Suivi_eleve : pas de cours le 01/12/2026 toute la journée pour 5e B (formation des enseignants).',
      );
      await http()
        .post(`/api/annonces/${body.id}/envoyer`)
        .set(avec('secretariat'))
        .expect(400);
    });

    it('annule un envoi programmé, qui ne part jamais', async () => {
      const { body } = await http()
        .post('/api/annonces')
        .set(avec('secretariat'))
        .send({
          type: 'PAS_DE_COURS',
          cible: 'CLASSES',
          classeIds: [classeB],
          date: '2026-12-02',
          creneau: 'le matin',
          motif: 'GREVE',
          programmeeLe: new Date(Date.now() + 120_000).toISOString(),
        })
        .expect(201);
      const annulee = await http()
        .post(`/api/annonces/${body.id}/annuler`)
        .set(avec('secretariat'))
        .expect(200);
      expect(annulee.body.statut).toBe('ANNULEE');
      expect(
        await prisma.notification.count({ where: { sourceId: body.id } }),
      ).toBe(0);
    });

    it.each([
      [
        'libération sans heure',
        { type: 'LIBERATION_ANTICIPEE', cible: 'ECOLE', motif: 'GREVE' },
      ],
      [
        'motif « autre » sans précision',
        {
          type: 'PAS_DE_COURS',
          cible: 'ECOLE',
          creneau: 'matin',
          motif: 'AUTRE',
        },
      ],
      [
        'classes sans liste',
        {
          type: 'PAS_DE_COURS',
          cible: 'CLASSES',
          creneau: 'matin',
          motif: 'GREVE',
        },
      ],
      [
        'programmation dans le passé',
        {
          type: 'PAS_DE_COURS',
          cible: 'ECOLE',
          creneau: 'matin',
          motif: 'GREVE',
          programmeeLe: '2020-01-01T08:00:00Z',
        },
      ],
    ])('refuse : %s', async (_, corps) => {
      await http()
        .post('/api/annonces')
        .set(avec('secretariat'))
        .send({ date: '2026-12-03', ...corps })
        .expect(400);
    });

    it('réserve la déclaration à la direction et au secrétariat', async () => {
      await http()
        .post('/api/annonces')
        .set(avec('enseignant'))
        .send({
          type: 'PAS_DE_COURS',
          cible: 'ECOLE',
          date: '2026-12-03',
          creneau: 'matin',
          motif: 'GREVE',
        })
        .expect(403);
      const liste = await http()
        .get('/api/annonces')
        .set(avec('enseignant'))
        .expect(200);
      expect(liste.body.total).toBe(3);
      expect(liste.body.elements[2]).toMatchObject({ familles: 2, lues: 1 });
      await http().get('/api/annonces').set(avec('parentAwa')).expect(403);
    });
  });

  describe('absences', () => {
    it("prévient la famille d'une absence injustifiée, une seule fois", async () => {
      const { body } = await http()
        .post('/api/absences')
        .set(avec('enseignant'))
        .send({
          eleveIds: [eleves.Awa, eleves.Ali],
          date: aujourdHui(),
          creneau: '08h-10h',
          matiere: 'mathématiques',
        })
        .expect(201);
      expect(body).toEqual({ creees: 2, dejaNotees: 0, famillesPrevenues: 2 });

      const absence = await prisma.absence.findFirstOrThrow({
        where: { eleveId: eleves.Awa },
      });
      const sms = await attendre(
        () =>
          prisma.notification.findFirst({
            where: { sourceId: absence.id, canal: 'SMS' },
          }),
        (n) => n?.statut === 'ENVOYEE',
      );
      const date = aujourdHui().split('-').reverse().join('/');
      expect(sms!.contenu).toBe(
        `Suivi_eleve : Awa (5e A) est absent(e) le ${date} (08h-10h) sans justification. Merci de contacter l'école.`,
      );
      expect(sms!.priorite).toBe('HAUTE');
      const email = await prisma.notification.findFirstOrThrow({
        where: { sourceId: absence.id, canal: 'APPLICATION' },
      });
      expect(email.contenu).toContain('(08h-10h, mathématiques)');

      // Même appel enregistré deux fois : rien n'est dupliqué ni renvoyé.
      const doublon = await http()
        .post('/api/absences')
        .set(avec('enseignant'))
        .send({
          eleveIds: [eleves.Awa],
          date: aujourdHui(),
          creneau: '08h-10h',
        })
        .expect(201);
      expect(doublon.body).toEqual({
        creees: 0,
        dejaNotees: 1,
        famillesPrevenues: 0,
      });
      expect(
        await prisma.notification.count({
          where: { sourceType: 'absence', tuteurId: tuteurs.Awa },
        }),
      ).toBe(2); // SMS + application
    });

    it("n'envoie rien pour une absence déjà justifiée", async () => {
      const { body } = await http()
        .post('/api/absences')
        .set(avec('surveillant'))
        .send({
          eleveIds: [eleves.Khady],
          date: aujourdHui(),
          creneau: 'journée',
          justifiee: true,
          motif: 'Malade, la mère a appelé',
        })
        .expect(201);
      expect(body.famillesPrevenues).toBe(0);
      expect(
        await prisma.notification.count({
          where: { sourceType: 'absence', tuteurId: tuteurs.Khady },
        }),
      ).toBe(0);
    });

    it.each([
      ['dans le futur', { date: '2099-01-01' }],
      ['sans créneau', { creneau: '' }],
      ['sans élève', { eleveIds: [] }],
    ])('refuse un appel %s', async (_, corps) => {
      await http()
        .post('/api/absences')
        .set(avec('enseignant'))
        .send({
          eleveIds: [eleves.Ali],
          date: aujourdHui(),
          creneau: '10h-12h',
          ...corps,
        })
        .expect(400);
    });

    it('le parent voit et motive, la vie scolaire justifie', async () => {
      const liste = await http()
        .get('/api/absences')
        .set(avec('parentAwa'))
        .expect(200);
      expect(liste.body).toMatchObject({ total: 1, nonJustifiees: 1 });
      const id = liste.body.elements[0].id;

      await http()
        .post(`/api/absences/${id}/justification-parent`)
        .set(avec('parentKhady'))
        .send({ motif: 'x' })
        .expect(404);
      const motive = await http()
        .post(`/api/absences/${id}/justification-parent`)
        .set(avec('parentAwa'))
        .send({ motif: 'Rendez-vous médical' })
        .expect(200);
      expect(motive.body).toMatchObject({
        justifiee: false,
        justificationParent: 'Rendez-vous médical',
      });

      await http()
        .post(`/api/absences/${id}/justifier`)
        .set(avec('enseignant'))
        .send({ motif: 'Certificat médical' })
        .expect(403);
      const justifiee = await http()
        .post(`/api/absences/${id}/justifier`)
        .set(avec('surveillant'))
        .send({ motif: 'Certificat médical reçu' })
        .expect(200);
      expect(justifiee.body).toMatchObject({
        justifiee: true,
        motif: 'Certificat médical reçu',
      });

      const classe = await http()
        .get(`/api/absences?classeId=${classeA}&justifiee=false`)
        .set(avec('secretariat'))
        .expect(200);
      expect(
        classe.body.elements.map(
          (a: { eleve: { prenoms: string } }) => a.eleve.prenoms,
        ),
      ).toEqual(['Ali']);
    });

    it('supprime une absence saisie par erreur', async () => {
      const [ali] = (
        await http()
          .get(`/api/absences?eleveId=${eleves.Ali}`)
          .set(avec('secretariat'))
          .expect(200)
      ).body.elements;
      await http()
        .delete(`/api/absences/${ali.id}`)
        .set(avec('enseignant'))
        .expect(403);
      await http()
        .delete(`/api/absences/${ali.id}`)
        .set(avec('secretariat'))
        .expect(204);
      expect(
        await prisma.absence.count({ where: { eleveId: eleves.Ali } }),
      ).toBe(0);
    });
  });
});
