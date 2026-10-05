// Événements de l'école : publication, rappel de la veille, réponses des parents, annulation.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AnnoncesService } from '../src/annonces/annonces.service.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import { Genre, LienTuteur, Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.BULLMQ_PREFIXE = `e2e-evenements-${randomUUID()}`;

/** Date (AAAA-MM-JJ) décalée de n jours par rapport à aujourd'hui. */
const jour = (decalage: number) =>
  new Date(Date.now() + decalage * 24 * 3600 * 1000).toISOString().slice(0, 10);
const jourFr = (j: string) => j.split('-').reverse().join('/');

describe('Événements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let annonces: AnnoncesService;
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
    annonces = app.get(AnnoncesService);
    const jwt = app.get(JwtService);

    await prisma.ecole.create({
      data: { id: ecoleId, nom: 'École des événements' },
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
        data: { ecoleId, anneeScolaireId: annee.id, nom, niveau: '4e' },
      });
    classeA = (await classe('4e A')).id;
    classeB = (await classe('4e B')).id;

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
          contact1: `+22176${randomInt(1_000_000, 9_999_999)}`.replace(
            /0$/,
            '1',
          ),
        },
      });
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `EVT-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2012-01-01'),
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
    await utilisateur('parentAwa', Role.PARENT, tuteurs.Awa);
    await utilisateur('parentAli', Role.PARENT, tuteurs.Ali);
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
  const messages = (sourceType: string, sourceId: string, canal = 'SMS') =>
    prisma.notification.findMany({
      where: { sourceType, sourceId, canal: canal as 'SMS' },
      orderBy: { creeLe: 'asc' },
    });

  const dans3Jours = jour(3);
  let sortie: { id: string };

  it('crée une sortie en brouillon : aucune famille prévenue avant publication', async () => {
    const { body } = await http()
      .post('/api/evenements')
      .set(avec('secretariat'))
      .send({
        titre: 'Sortie au musée',
        description: 'Visite du Musée des civilisations noires.',
        date: dans3Jours,
        heure: '09:00',
        lieu: 'Musée des civilisations noires',
        modalites: 'Départ en car devant l’école, retour vers 13h.',
        cible: 'CLASSES',
        classeIds: [classeA],
        question: 'Autorisez-vous votre enfant à participer à la sortie ?',
      })
      .expect(201);
    sortie = body;
    expect(body).toMatchObject({
      statut: 'BROUILLON',
      demandeReponse: true,
      pieceJointe: null,
      reponses: { oui: 0, non: 0, sansReponse: 2 },
    });
    expect(await messages('annonce', body.id)).toHaveLength(0);
    // Le parent ne voit pas un brouillon.
    await http()
      .get(`/api/evenements/${body.id}`)
      .set(avec('parentAwa'))
      .expect(404);
  });

  it('joint un PDF, mais refuse un autre type de fichier', async () => {
    await http()
      .post(`/api/evenements/${sortie.id}/piece-jointe`)
      .set(avec('secretariat'))
      .attach('fichier', Buffer.from('<html></html>'), 'page.html')
      .expect(400);
    const { body } = await http()
      .post(`/api/evenements/${sortie.id}/piece-jointe`)
      .set(avec('secretariat'))
      .attach('fichier', Buffer.from('%PDF-1.4\n%%EOF\n'), 'autorisation.pdf')
      .expect(201);
    expect(body.pieceJointe).toBe('PDF');
  });

  it('publie : les familles de la classe sont prévenues et le rappel de la veille est programmé', async () => {
    const { body } = await http()
      .post(`/api/evenements/${sortie.id}/publier`)
      .set(avec('secretariat'))
      .send({})
      .expect(200);
    expect(body.statut).toBe('ENVOYEE');
    expect(body.suivi.familles).toBe(2);

    const sms = await messages('annonce', sortie.id);
    expect(sms.map((s) => s.tuteurId).sort()).toEqual(
      [tuteurs.Awa, tuteurs.Ali].sort(),
    );
    expect(sms[0].contenu).toBe(
      `Suivi_eleve : Sortie au musée le ${jourFr(dans3Jours)} à 09h00 (Musée des civilisations noires). Détails dans l'application.`,
    );
    const [historique] = await messages('annonce', sortie.id, 'APPLICATION');
    expect(historique.contenu).toContain(
      'Modalités : Départ en car devant l’école, retour vers 13h.',
    );
    expect(historique.contenu).toContain(
      "Merci de répondre dans l'application : Autorisez-vous votre enfant à participer à la sortie ?",
    );

    const rappel = await annonces['file'].getJob(`rappel-${sortie.id}`);
    expect(rappel?.name).toBe('rappel');
    const veille = new Date(`${jour(2)}T18:00:00.000Z`).getTime();
    expect(rappel!.timestamp + rappel!.delay).toBeGreaterThanOrEqual(
      veille - 1000,
    );
    expect(rappel!.timestamp + rappel!.delay).toBeLessThanOrEqual(
      veille + 1000,
    );

    await http()
      .post(`/api/evenements/${sortie.id}/publier`)
      .set(avec('secretariat'))
      .send({})
      .expect(400);
  });

  it('les parents voient l’événement de leur classe, avec la pièce jointe', async () => {
    const calendrier = await http()
      .get('/api/evenements')
      .query({ du: jour(0), au: jour(10) })
      .set(avec('parentAwa'))
      .expect(200);
    expect(calendrier.body).toHaveLength(1);
    expect(calendrier.body[0]).toMatchObject({
      id: sortie.id,
      enfants: [{ id: eleves.Awa, reponse: null }],
    });
    const piece = await http()
      .get(`/api/evenements/${sortie.id}/piece-jointe`)
      .set(avec('parentAwa'))
      .expect(200);
    expect(piece.headers['content-type']).toBe('application/pdf');

    const khady = await http()
      .get('/api/evenements')
      .query({ du: jour(0), au: jour(10) })
      .set(avec('parentKhady'))
      .expect(200);
    expect(khady.body).toHaveLength(0);
    await http()
      .get(`/api/evenements/${sortie.id}/piece-jointe`)
      .set(avec('parentKhady'))
      .expect(404);
  });

  it('enregistre les réponses des parents, élève par élève', async () => {
    await http()
      .post(`/api/evenements/${sortie.id}/reponses`)
      .set(avec('parentAwa'))
      .send({ eleveId: eleves.Awa, reponse: false })
      .expect(200);
    // Le parent peut changer d'avis.
    const { body } = await http()
      .post(`/api/evenements/${sortie.id}/reponses`)
      .set(avec('parentAwa'))
      .send({ eleveId: eleves.Awa, reponse: true, commentaire: 'Elle a hâte.' })
      .expect(200);
    expect(body.enfants).toEqual([
      expect.objectContaining({ id: eleves.Awa, reponse: true }),
    ]);
    // Pas pour l'enfant d'un autre, ni pour un événement d'une autre classe.
    await http()
      .post(`/api/evenements/${sortie.id}/reponses`)
      .set(avec('parentAwa'))
      .send({ eleveId: eleves.Ali, reponse: true })
      .expect(403);
    await http()
      .post(`/api/evenements/${sortie.id}/reponses`)
      .set(avec('parentKhady'))
      .send({ eleveId: eleves.Khady, reponse: true })
      .expect(404);
    await http()
      .post(`/api/evenements/${sortie.id}/reponses`)
      .set(avec('secretariat'))
      .send({ eleveId: eleves.Awa, reponse: true })
      .expect(403);

    const detail = await http()
      .get(`/api/evenements/${sortie.id}`)
      .set(avec('enseignant'))
      .expect(200);
    expect(detail.body.reponses).toMatchObject({
      oui: 1,
      non: 0,
      sansReponse: 1,
    });
    expect(detail.body.reponses.eleves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: eleves.Awa,
          reponse: true,
          commentaire: 'Elle a hâte.',
          repondant: { prenoms: 'Parent de Awa', nom: 'Test' },
        }),
        expect.objectContaining({ id: eleves.Ali, reponse: null }),
      ]),
    );
    const liste = await http()
      .get('/api/evenements')
      .query({ du: jour(0), au: jour(10) })
      .set(avec('enseignant'))
      .expect(200);
    expect(liste.body[0].reponses).toEqual({ oui: 1, non: 0 });
  });

  it('envoie le rappel de la veille une seule fois', async () => {
    await annonces.envoyerRappel(sortie.id);
    await annonces.envoyerRappel(sortie.id);
    const rappels = await messages('annonce-rappel', sortie.id);
    expect(rappels).toHaveLength(2);
    expect(rappels[0].contenu).toBe(
      `Suivi_eleve : Rappel, demain : Sortie au musée le ${jourFr(dans3Jours)} à 09h00 (Musée des civilisations noires). Détails dans l'application.`,
    );
    // Le suivi de la publication ne compte pas le rappel.
    const { body } = await http()
      .get(`/api/evenements/${sortie.id}`)
      .set(avec('secretariat'))
      .expect(200);
    expect(body.suivi.familles).toBe(2);
    expect(body.rappelEnvoyeLe).not.toBeNull();
  });

  it('annule : les familles prévenues sont informées, plus de réponse possible', async () => {
    const { body } = await http()
      .post(`/api/evenements/${sortie.id}/annuler`)
      .set(avec('secretariat'))
      .expect(200);
    expect(body.statut).toBe('ANNULEE');
    const annulations = await messages('annonce-annulation', sortie.id);
    expect(annulations).toHaveLength(2);
    expect(annulations[0].contenu).toBe(
      `Suivi_eleve : Annulé : Sortie au musée le ${jourFr(dans3Jours)} à 09h00 (Musée des civilisations noires). Détails dans l'application.`,
    );
    await http()
      .post(`/api/evenements/${sortie.id}/reponses`)
      .set(avec('parentAwa'))
      .send({ eleveId: eleves.Awa, reponse: false })
      .expect(400);
    // L'événement annulé reste visible du parent.
    const detail = await http()
      .get(`/api/evenements/${sortie.id}`)
      .set(avec('parentAwa'))
      .expect(200);
    expect(detail.body.statut).toBe('ANNULEE');
    await http()
      .post(`/api/evenements/${sortie.id}/annuler`)
      .set(avec('secretariat'))
      .expect(400);
  });

  it('programme une fête pour toute l’école, puis l’annule sans prévenir personne', async () => {
    const { body } = await http()
      .post('/api/evenements')
      .set(avec('secretariat'))
      .send({
        titre: "Fête de l'école",
        description: 'Spectacle et repas partagé.',
        date: jour(20),
        heure: '15:00',
        dateFin: jour(21),
        lieu: "Cour de l'école",
        cible: 'ECOLE',
      })
      .expect(201);
    expect(body.reponses).toBeNull();
    const programme = await http()
      .post(`/api/evenements/${body.id}/publier`)
      .send({ programmeeLe: new Date(Date.now() + 3600_000).toISOString() })
      .set(avec('secretariat'))
      .expect(200);
    expect(programme.body.statut).toBe('PROGRAMMEE');
    // Le parent ne le voit pas avant l'envoi.
    const avant = await http()
      .get('/api/evenements')
      .query({ du: jour(0), au: jour(30) })
      .set(avec('parentKhady'))
      .expect(200);
    expect(avant.body).toHaveLength(0);

    await http()
      .post(`/api/evenements/${body.id}/annuler`)
      .set(avec('secretariat'))
      .expect(200);
    expect(await annonces['file'].getJob(body.id)).toBeUndefined();
    expect(await messages('annonce-annulation', body.id)).toHaveLength(0);
  });

  it.each([
    ['événement passé', { date: jour(-1) }, 'à venir'],
    ['heure invalide', { heure: '25:00' }, 'HH:MM'],
    ['fin avant le début', { dateFin: jour(1) }, 'date de fin'],
    ['sans classe', { cible: 'CLASSES', classeIds: [] }, 'au moins une classe'],
    ['sans lieu', { lieu: '' }, 'lieu'],
  ])('refuse : %s', async (_cas, modif, attendu) => {
    const { body } = await http()
      .post('/api/evenements')
      .set(avec('secretariat'))
      .send({
        titre: 'Réunion',
        description: 'Réunion des parents.',
        date: jour(5),
        heure: '10:00',
        lieu: 'Salle polyvalente',
        cible: 'ECOLE',
        ...modif,
      })
      .expect(400);
    expect(JSON.stringify(body.message)).toContain(attendu);
  });

  it('réserve la création au secrétariat et à la direction', async () => {
    await http()
      .post('/api/evenements')
      .set(avec('enseignant'))
      .send({})
      .expect(403);
    await http()
      .post('/api/evenements')
      .set(avec('parentAwa'))
      .send({})
      .expect(403);
  });

  it('supprime un brouillon, jamais un événement publié', async () => {
    const { body } = await http()
      .post('/api/evenements')
      .set(avec('secretariat'))
      .send({
        titre: 'Brouillon',
        description: 'À supprimer.',
        date: jour(4),
        heure: '08:00',
        lieu: 'École',
        cible: 'CLASSES',
        classeIds: [classeB],
      })
      .expect(201);
    await http()
      .delete(`/api/evenements/${body.id}`)
      .set(avec('secretariat'))
      .expect(204);
    await http()
      .delete(`/api/evenements/${sortie.id}`)
      .set(avec('secretariat'))
      .expect(400);
  });
});
