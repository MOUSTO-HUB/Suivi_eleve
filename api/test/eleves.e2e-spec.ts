// Élèves, tuteurs et classes sur une vraie base PostgreSQL (pnpm db:up && pnpm db:migrate).
// Le test crée sa propre école et la supprime à la fin.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import type { ChargeJeton } from '../src/auth/auth.types.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Élèves, tuteurs et classes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const ecoleId = randomUUID();
  const autreEcoleId = randomUUID();
  // Numéros propres à ce test : 70 + 7 chiffres aléatoires.
  const base = randomInt(1_000_000, 8_999_000);
  const tel = (n: number) => `+22170${base + n}`;
  const telLocal = (n: number) => {
    const chiffres = `70${base + n}`;
    return `${chiffres.slice(0, 2)} ${chiffres.slice(2, 5)} ${chiffres.slice(5, 7)} ${chiffres.slice(7)}`;
  };

  let secretariat: string;
  let enseignant: string;
  let classeA: string;
  let classeB: string;
  let classeAutreEcole: string;

  const jeton = (charge: Omit<ChargeJeton, 'ecoleId'> & { ecoleId?: string }) =>
    jwt.sign({ ecoleId, ...charge });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    for (const id of [ecoleId, autreEcoleId]) {
      await prisma.ecole.create({ data: { id, nom: `École e2e ${id}` } });
    }
    const annee = await prisma.anneeScolaire.create({
      data: {
        ecoleId,
        libelle: '2026-2027',
        dateDebut: new Date('2026-10-01'),
        dateFin: new Date('2027-07-15'),
        active: true,
      },
    });
    const anneeAutre = await prisma.anneeScolaire.create({
      data: {
        ecoleId: autreEcoleId,
        libelle: '2026-2027',
        dateDebut: new Date('2026-10-01'),
        dateFin: new Date('2027-07-15'),
        active: true,
      },
    });
    const utilisateur = (role: Role) =>
      prisma.utilisateur.create({
        data: { ecoleId, prenoms: 'Test', nom: role, role },
      });
    const sec = await utilisateur(Role.SECRETARIAT);
    const ens = await utilisateur(Role.ENSEIGNANT);
    secretariat = jeton({ sub: sec.id, role: Role.SECRETARIAT });
    enseignant = jeton({ sub: ens.id, role: Role.ENSEIGNANT });

    const classe = (nom: string, anneeScolaireId: string, ecole = ecoleId) =>
      prisma.classe.create({
        data: { ecoleId: ecole, anneeScolaireId, nom, niveau: nom.slice(0, 2) },
      });
    classeA = (await classe('6e A', annee.id)).id;
    classeB = (await classe('6e B', annee.id)).id;
    classeAutreEcole = (await classe('6e A', anneeAutre.id, autreEcoleId)).id;
  });

  afterAll(async () => {
    for (const id of [ecoleId, autreEcoleId]) {
      await prisma.journalAudit.deleteMany({ where: { ecoleId: id } });
      await prisma.eleve.deleteMany({ where: { ecoleId: id } });
      await prisma.tuteur.deleteMany({ where: { ecoleId: id } });
      await prisma.classe.deleteMany({ where: { ecoleId: id } });
      await prisma.anneeScolaire.deleteMany({ where: { ecoleId: id } });
      await prisma.utilisateur.deleteMany({ where: { ecoleId: id } });
      await prisma.ecole.delete({ where: { id } });
    }
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

  const nouvelEleve = (surcharge: Record<string, unknown> = {}) => ({
    prenoms: 'Awa',
    nom: 'Diop',
    genre: 'FEMININ',
    dateNaissance: '2014-03-15',
    classeId: classeA,
    tuteurs: [
      {
        prenoms: 'Malick',
        nom: 'Diop',
        contact1: telLocal(1).replace(/^70/, '+221 70'),
        lien: 'PERE',
      },
    ],
    ...surcharge,
  });

  let awa: { id: string; matricule: string; tuteurs: { id: string }[] };
  let ali: { id: string };

  describe('création', () => {
    it('inscrit un élève avec un nouveau tuteur et lui donne un matricule', async () => {
      const { body } = await http()
        .post('/api/eleves')
        .set(avec(secretariat))
        .send(nouvelEleve())
        .expect(201);
      awa = body;
      expect(body.matricule).toMatch(/^SE-\d{4}-\d{4,}$/);
      expect(body.age).toBeGreaterThanOrEqual(12);
      expect(body.classe.nom).toBe('6e A');
      expect(body.tuteurs).toHaveLength(1);
      expect(body.tuteurs[0]).toMatchObject({
        contact1: tel(1),
        principal: true,
        lien: 'PERE',
      });
      expect(body.historiqueClasse).toEqual([
        expect.objectContaining({
          classe: { id: classeA, nom: '6e A' },
          dateFin: null,
        }),
      ]);
    });

    it('réutilise le tuteur pour un frère (même Contact_tuteur_1)', async () => {
      const { body } = await http()
        .post('/api/eleves')
        .set(avec(secretariat))
        .send(
          nouvelEleve({
            prenoms: 'Ali',
            genre: 'MASCULIN',
            dateNaissance: '2016-07-01',
            classeId: classeB,
          }),
        )
        .expect(201);
      ali = body;
      expect(body.tuteurs[0].id).toBe(awa.tuteurs[0].id);
      expect(body.matricule).not.toBe(awa.matricule);
      expect(
        await prisma.tuteur.count({ where: { ecoleId, contact1: tel(1) } }),
      ).toBe(1);
    });

    // Fonctions : les ids des classes ne sont connus qu'après beforeAll.
    it.each([
      ['sans tuteur', () => ({ tuteurs: [] })],
      ['date impossible', () => ({ dateNaissance: '2014-02-30' })],
      ['genre inconnu', () => ({ genre: 'X' })],
      ["classe d'une autre école", () => ({ classeId: classeAutreEcole })],
      [
        'tuteur sans Contact_tuteur_1',
        () => ({ tuteurs: [{ prenoms: 'A', nom: 'B', lien: 'MERE' }] }),
      ],
    ])('refuse : %s', async (_, surcharge) => {
      await http()
        .post('/api/eleves')
        .set(avec(secretariat))
        .send(nouvelEleve(surcharge()))
        .expect(400);
    });

    it("interdit l'inscription à un enseignant", async () => {
      await http()
        .post('/api/eleves')
        .set(avec(enseignant))
        .send(nouvelEleve({ prenoms: 'Interdit' }))
        .expect(403);
    });
  });

  describe('liste et recherche', () => {
    it('recherche par nom, classe et tuteur, avec pagination', async () => {
      const tous = await http()
        .get('/api/eleves?q=diop')
        .set(avec(enseignant))
        .expect(200);
      expect(tous.body).toMatchObject({
        total: 2,
        page: 1,
        parPage: 25,
        pages: 1,
      });

      const parClasse = await http()
        .get(`/api/eleves?classeId=${classeB}`)
        .set(avec(enseignant))
        .expect(200);
      expect(parClasse.body.elements.map((e: { id: string }) => e.id)).toEqual([
        ali.id,
      ]);

      const parTuteurEtPrenom = await http()
        .get('/api/eleves?q=malick%20awa')
        .set(avec(enseignant))
        .expect(200);
      expect(parTuteurEtPrenom.body.total).toBe(1);

      const page2 = await http()
        .get('/api/eleves?parPage=1&page=2')
        .set(avec(enseignant))
        .expect(200);
      expect(page2.body).toMatchObject({ total: 2, pages: 2 });
      expect(page2.body.elements).toHaveLength(1);
    });
  });

  describe('parent', () => {
    let parent: string;
    let autre: { id: string };

    beforeAll(async () => {
      parent = jeton({
        sub: randomUUID(),
        role: Role.PARENT,
        tuteurId: awa.tuteurs[0].id,
      });
      const { body } = await http()
        .post('/api/eleves')
        .set(avec(secretariat))
        .send(
          nouvelEleve({
            prenoms: 'Khady',
            nom: 'Sarr',
            tuteurs: [
              {
                prenoms: 'Yacine',
                nom: 'Sarr',
                contact1: tel(2),
                lien: 'MERE',
              },
            ],
          }),
        )
        .expect(201);
      autre = body;
    });

    it('ne voit que ses enfants', async () => {
      const { body } = await http()
        .get('/api/eleves')
        .set(avec(parent))
        .expect(200);
      expect(body.elements.map((e: { id: string }) => e.id).sort()).toEqual(
        [awa.id, ali.id].sort(),
      );
      await http().get(`/api/eleves/${awa.id}`).set(avec(parent)).expect(200);
      await http().get(`/api/eleves/${autre.id}`).set(avec(parent)).expect(403);
    });

    it("n'accède ni aux tuteurs, ni aux classes, ni aux modifications", async () => {
      await http().get('/api/tuteurs').set(avec(parent)).expect(403);
      await http().get('/api/classes').set(avec(parent)).expect(403);
      await http()
        .patch(`/api/eleves/${awa.id}`)
        .set(avec(parent))
        .send({ prenoms: 'X' })
        .expect(403);
      await http().get('/api/eleves/export').set(avec(parent)).expect(403);
    });
  });

  describe('vie du dossier', () => {
    it('modifie, change de classe avec historique, archive et restaure', async () => {
      const modifie = await http()
        .patch(`/api/eleves/${awa.id}`)
        .set(avec(secretariat))
        .send({ prenoms: 'Awa Fatou', telephone: '+221 70 000 00 01' })
        .expect(200);
      expect(modifie.body).toMatchObject({
        prenoms: 'Awa Fatou',
        telephone: '+221700000001',
      });

      const change = await http()
        .post(`/api/eleves/${awa.id}/changer-classe`)
        .set(avec(secretariat))
        .send({ classeId: classeB, date: '2026-11-02' })
        .expect(201);
      expect(change.body.classe.id).toBe(classeB);
      expect(change.body.historiqueClasse).toEqual([
        {
          classe: { id: classeB, nom: '6e B' },
          dateDebut: '2026-11-02',
          dateFin: null,
        },
        expect.objectContaining({
          classe: { id: classeA, nom: '6e A' },
          dateFin: '2026-11-02',
        }),
      ]);
      await http()
        .post(`/api/eleves/${awa.id}/changer-classe`)
        .set(avec(secretariat))
        .send({ classeId: classeB })
        .expect(400);

      await http()
        .post(`/api/eleves/${awa.id}/archiver`)
        .set(avec(secretariat))
        .send({ motif: 'Départ de la famille' })
        .expect(201);
      const actifs = await http()
        .get('/api/eleves?q=diop')
        .set(avec(secretariat))
        .expect(200);
      expect(actifs.body.total).toBe(1);
      const archives = await http()
        .get('/api/eleves?statut=ARCHIVE')
        .set(avec(secretariat))
        .expect(200);
      expect(archives.body.elements[0].id).toBe(awa.id);
      expect(
        await prisma.journalAudit.count({
          where: { ecoleId, entiteId: awa.id, action: 'ARCHIVAGE' },
        }),
      ).toBe(1);

      const restaure = await http()
        .post(`/api/eleves/${awa.id}/restaurer`)
        .set(avec(secretariat))
        .expect(201);
      expect(restaure.body.statut).toBe('ACTIF');
    });

    it('ajoute un second tuteur principal et garde toujours au moins un tuteur', async () => {
      const ajoute = await http()
        .post(`/api/eleves/${ali.id}/tuteurs`)
        .set(avec(secretariat))
        .send({
          prenoms: 'Astou',
          nom: 'Diop',
          contact1: tel(3),
          lien: 'MERE',
          principal: true,
        })
        .expect(201);
      expect(ajoute.body.tuteurs).toHaveLength(2);
      expect(ajoute.body.tuteurs[0]).toMatchObject({
        prenoms: 'Astou',
        principal: true,
      });

      const mere = ajoute.body.tuteurs[0].id;
      const pere = ajoute.body.tuteurs[1].id;
      const retire = await http()
        .delete(`/api/eleves/${ali.id}/tuteurs/${mere}`)
        .set(avec(secretariat))
        .expect(200);
      expect(retire.body.tuteurs).toEqual([
        expect.objectContaining({ id: pere, principal: true }),
      ]);
      await http()
        .delete(`/api/eleves/${ali.id}/tuteurs/${pere}`)
        .set(avec(secretariat))
        .expect(400);
    });
  });

  describe('import et export', () => {
    const csv = () =>
      [
        'prenoms;nom;genre;date_naissance;classe;tuteur_prenoms;tuteur_nom;lien_tuteur;contact_tuteur_1',
        `Moussa;Ndiaye;M;02/05/2015;6e B;Omar;Ndiaye;père;${telLocal(4)}`,
        `Sans;Genre;;02/05/2015;6e B;Omar;Ndiaye;père;${telLocal(4)}`,
        `Ali;Diop;M;01/07/2016;6e A;Malick;Diop;père;${telLocal(1)}`,
        `Inconnue;Classe;F;02/05/2015;3e Z;Omar;Ndiaye;père;${telLocal(4)}`,
      ].join('\n');

    it('simule puis importe, avec un rapport ligne par ligne', async () => {
      const simulation = await http()
        .post('/api/eleves/import?simulation=true')
        .set(avec(secretariat))
        .attach('fichier', Buffer.from(csv()), 'eleves.csv')
        .expect(201);
      expect(simulation.body).toMatchObject({
        simulation: true,
        totalLignes: 4,
        valides: 1,
        crees: 0,
      });
      expect(simulation.body.erreurs).toEqual([
        { ligne: 3, messages: ['Genre manquant.'] },
        {
          ligne: 4,
          messages: [expect.stringMatching(/^Élève déjà enregistré/)],
        },
        { ligne: 5, messages: ['Classe inconnue : « 3e Z ».'] },
      ]);
      expect(
        await prisma.eleve.count({ where: { ecoleId, nom: 'Ndiaye' } }),
      ).toBe(0);

      const reel = await http()
        .post('/api/eleves/import')
        .set(avec(secretariat))
        .attach('fichier', Buffer.from(csv()), 'eleves.csv')
        .expect(201);
      expect(reel.body).toMatchObject({
        simulation: false,
        valides: 1,
        crees: 1,
      });
      const moussa = await prisma.eleve.findFirstOrThrow({
        where: { ecoleId, nom: 'Ndiaye' },
        include: { tuteurs: { include: { tuteur: true } } },
      });
      expect(moussa.matricule).toMatch(/^SE-\d{4}-\d{4,}$/);
      expect(moussa.tuteurs[0].tuteur.contact1).toBe(tel(4));
    });

    it('refuse un format de fichier inconnu', async () => {
      await http()
        .post('/api/eleves/import')
        .set(avec(secretariat))
        .attach('fichier', Buffer.from('x'), 'eleves.pdf')
        .expect(400);
    });

    it('exporte en CSV et en Excel', async () => {
      const csvExport = await http()
        .get('/api/eleves/export?format=csv')
        .set(avec(enseignant))
        .expect(200);
      expect(csvExport.headers['content-type']).toMatch(/text\/csv/);
      const lignes = csvExport.text.replace(/^﻿/, '').trim().split('\r\n');
      expect(lignes[0]).toMatch(/^matricule;prenoms;nom;genre;date_naissance/);
      expect(lignes).toHaveLength(1 + 4);
      expect(csvExport.text).toContain(awa.matricule);

      const xlsx = await http()
        .get('/api/eleves/export?format=xlsx')
        .set(avec(enseignant))
        .buffer(true)
        .parse((res, fin) => {
          const morceaux: Buffer[] = [];
          res.on('data', (m: Buffer) => morceaux.push(m));
          res.on('end', () => fin(null, Buffer.concat(morceaux)));
        })
        .expect(200);
      expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    });
  });

  describe('tuteurs et classes', () => {
    it('recherche un tuteur et refuse un Contact_tuteur_1 déjà pris', async () => {
      const { body } = await http()
        .get(`/api/tuteurs?q=${encodeURIComponent(tel(1).slice(-6))}`)
        .set(avec(enseignant))
        .expect(200);
      expect(body.elements[0]).toMatchObject({
        prenoms: 'Malick',
        nombreEleves: 2,
      });

      await http()
        .post('/api/tuteurs')
        .set(avec(secretariat))
        .send({ prenoms: 'Double', nom: 'Doublon', contact1: tel(1) })
        .expect(409);
    });

    it('liste les classes avec leur effectif et refuse un nom en double', async () => {
      const { body } = await http()
        .get('/api/classes')
        .set(avec(enseignant))
        .expect(200);
      expect(
        body.map((c: { nom: string; effectif: number }) => [c.nom, c.effectif]),
      ).toEqual([
        ['6e A', 1],
        ['6e B', 3],
      ]);
      await http()
        .post('/api/classes')
        .set(avec(secretariat))
        .send({ nom: '6e A', niveau: '6e' })
        .expect(409);
      await http()
        .post('/api/classes')
        .set(avec(enseignant))
        .send({ nom: '5e A', niveau: '5e' })
        .expect(403);
    });
  });
});
