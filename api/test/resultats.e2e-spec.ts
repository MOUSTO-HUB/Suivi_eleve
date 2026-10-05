// Résultats saisis par les professeurs (aucun calcul), publication, bulletins et décisions.
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

process.env.BULLMQ_PREFIXE = `e2e-resultats-${randomUUID()}`;

const pdf = (
  res: request.Response,
  fin: (e: Error | null, b: Buffer) => void,
) => {
  const morceaux: Buffer[] = [];
  res.on('data', (m: Buffer) => morceaux.push(m));
  res.on('end', () => fin(null, Buffer.concat(morceaux)));
};

describe('Résultats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let t1: string;
  let t2: string;
  let classeId: string;
  let autreClasseEleve: string;
  const eleves: string[] = [];

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
      data: { id: ecoleId, nom: 'École des résultats' },
    });
    const annee = await prisma.anneeScolaire.create({
      data: {
        ecoleId,
        libelle: '2026-2027',
        dateDebut: new Date('2026-10-01'),
        dateFin: new Date('2027-07-15'),
        active: true,
        periodes: {
          create: [
            {
              ordre: 1,
              libelle: 'Trimestre 1',
              dateDebut: new Date('2026-10-01'),
              dateFin: new Date('2026-12-20'),
            },
            {
              ordre: 2,
              libelle: 'Trimestre 2',
              dateDebut: new Date('2027-01-04'),
              dateFin: new Date('2027-03-31'),
            },
          ],
        },
      },
      include: { periodes: { orderBy: { ordre: 'asc' } } },
    });
    [t1, t2] = annee.periodes.map((p) => p.id);

    const utilisateur = async (cle: string, role: Role, extra: object = {}) => {
      const u = await prisma.utilisateur.create({
        data: { ecoleId, prenoms: cle, nom: 'Test', role, ...extra },
      });
      ids[cle] = u.id;
      return u.id;
    };
    await utilisateur('admin', Role.ADMIN);
    await utilisateur('secretariat', Role.SECRETARIAT);
    await utilisateur('principal', Role.ENSEIGNANT);
    await utilisateur('profFrancais', Role.ENSEIGNANT);
    await utilisateur('profAutre', Role.ENSEIGNANT);

    const classe = await prisma.classe.create({
      data: {
        ecoleId,
        anneeScolaireId: annee.id,
        nom: '4e A',
        niveau: '4e',
        enseignantPrincipalId: ids.principal,
      },
    });
    classeId = classe.id;
    const autreClasse = await prisma.classe.create({
      data: { ecoleId, anneeScolaireId: annee.id, nom: '4e B', niveau: '4e' },
    });
    const matiere = (nom: string, coefficient: number) =>
      prisma.matiere.create({ data: { ecoleId, nom, coefficient } });
    ids.maths = (await matiere('Mathématiques', 4)).id;
    ids.francais = (await matiere('Français', 3)).id;
    await prisma.enseignement.createMany({
      data: [
        { classeId, matiereId: ids.maths, enseignantId: ids.principal },
        { classeId, matiereId: ids.francais, enseignantId: ids.profFrancais },
      ],
    });

    for (const [i, prenoms] of ['Awa', 'Ali', 'Fatou'].entries()) {
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `RES-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2012-02-0' + (i + 1)),
          classeId,
          tuteurs: {
            create: {
              lien: LienTuteur.MERE,
              principal: true,
              tuteur: {
                create: {
                  ecoleId,
                  prenoms: `Parent ${prenoms}`,
                  nom: 'Test',
                  contact1: `+22175${randomInt(1_000_000, 9_999_999)}`.replace(
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
      eleves.push(e.id);
      if (i === 0) ids.tuteurAwa = e.tuteurs[0].tuteurId;
    }
    autreClasseEleve = (
      await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `RES-${randomUUID()}`,
          prenoms: 'Ailleurs',
          nom: 'Test',
          genre: Genre.MASCULIN,
          dateNaissance: new Date('2012-05-05'),
          classeId: autreClasse.id,
        },
      })
    ).id;
    await utilisateur('parentAwa', Role.PARENT, {
      tuteur: { connect: { id: ids.tuteurAwa } },
    });

    for (const [cle, id] of Object.entries(ids)) {
      const u = await prisma.utilisateur.findUnique({ where: { id } });
      if (u) {
        jetons[cle] = jwt.sign({
          sub: u.id,
          role: u.role,
          ecoleId,
          ...(cle === 'parentAwa' ? { tuteurId: ids.tuteurAwa } : {}),
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { ecoleId } });
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.eleve.deleteMany({ where: { ecoleId } });
    await prisma.tuteur.deleteMany({ where: { ecoleId } });
    await prisma.classe.deleteMany({ where: { ecoleId } });
    await prisma.matiere.deleteMany({ where: { ecoleId } });
    await prisma.anneeScolaire.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const avec = (qui: string) => ({ Authorization: `Bearer ${jetons[qui]}` });
  const lignes = (valeurs: (number | null)[]) =>
    valeurs.map((moyenne, i) => ({ eleveId: eleves[i], moyenne }));

  it('montre à chaque professeur ce qu’il peut saisir', async () => {
    const mes = await http()
      .get('/api/resultats/mes-saisies')
      .set(avec('profFrancais'))
      .expect(200);
    expect(mes.body.enseignements).toEqual([
      expect.objectContaining({
        matiere: { id: ids.francais, nom: 'Français' },
      }),
    ]);
    expect(mes.body.classesPrincipales).toEqual([]);

    const grille = await http()
      .get(`/api/resultats/saisie?classeId=${classeId}&periodeId=${t1}`)
      .set(avec('profFrancais'))
      .expect(200);
    expect(
      grille.body.matieres.map((m: { nom: string; peutSaisir: boolean }) => [
        m.nom,
        m.peutSaisir,
      ]),
    ).toEqual([
      ['Français', true],
      ['Mathématiques', false],
    ]);
    expect(grille.body).toMatchObject({
      peutSaisirGeneral: false,
      peutPublier: false,
      publie: false,
    });
    expect(grille.body.eleves).toHaveLength(3);

    await http()
      .get(`/api/resultats/saisie?classeId=${classeId}&periodeId=${t1}`)
      .set(avec('profAutre'))
      .expect(403);
  });

  it('enregistre les moyennes de chaque matière telles que saisies', async () => {
    await http()
      .put('/api/resultats/moyennes')
      .set(avec('profFrancais'))
      .send({
        classeId,
        periodeId: t1,
        matiereId: ids.francais,
        lignes: [
          {
            eleveId: eleves[0],
            moyenne: 14.5,
            appreciation: 'Très bon trimestre',
          },
          { eleveId: eleves[1], moyenne: 9.25 },
          { eleveId: eleves[2], moyenne: null },
        ],
      })
      .expect(200);
    await http()
      .put('/api/resultats/moyennes')
      .set(avec('profFrancais'))
      .send({
        classeId,
        periodeId: t1,
        matiereId: ids.maths,
        lignes: lignes([12]),
      })
      .expect(403);
    await http()
      .put('/api/resultats/moyennes')
      .set(avec('principal'))
      .send({
        classeId,
        periodeId: t1,
        matiereId: ids.maths,
        lignes: lignes([16, 8.75, 12.34]),
      })
      .expect(200);

    for (const [corps, motif] of [
      [lignes([21]), /entre 0 et 20/],
      [lignes([12.345]), /2 décimales/],
      [[{ eleveId: autreClasseEleve, moyenne: 10 }], /inconnu/],
    ] as const) {
      const { body } = await http()
        .put('/api/resultats/moyennes')
        .set(avec('principal'))
        .send({ classeId, periodeId: t1, matiereId: ids.maths, lignes: corps })
        .expect(400);
      expect(body.message).toMatch(motif);
    }

    const grille = await http()
      .get(`/api/resultats/saisie?classeId=${classeId}&periodeId=${t1}`)
      .set(avec('principal'))
      .expect(200);
    // La grille est triée par nom puis prénoms : on cherche chaque élève par son id.
    const ligne = (id: string) =>
      grille.body.eleves.find((e: { id: string }) => e.id === id);
    expect(ligne(eleves[0]).moyennes[ids.francais]).toEqual({
      moyenne: 14.5,
      appreciation: 'Très bon trimestre',
    });
    expect(ligne(eleves[2]).moyennes[ids.maths].moyenne).toBe(12.34);
    expect(
      grille.body.matieres.find((m: { nom: string }) => m.nom === 'Français')
        .saisies,
    ).toBe(2);
  });

  it('réserve la moyenne générale et le rang au professeur principal', async () => {
    await http()
      .put('/api/resultats/generaux')
      .set(avec('profFrancais'))
      .send({ classeId, periodeId: t1, lignes: lignes([15]) })
      .expect(403);
    const { body } = await http()
      .put('/api/resultats/generaux')
      .set(avec('principal'))
      .send({
        classeId,
        periodeId: t1,
        lignes: [{ eleveId: eleves[0], moyenne: 15, rang: 4 }],
      })
      .expect(400);
    expect(body.message).toMatch(/entre 1 et 3/);

    await http()
      .put('/api/resultats/generaux')
      .set(avec('principal'))
      .send({
        classeId,
        periodeId: t1,
        lignes: [
          {
            eleveId: eleves[0],
            moyenne: 15.25,
            rang: 1,
            appreciation: 'Excellent travail',
          },
          { eleveId: eleves[1], moyenne: 9, rang: 2 },
        ],
      })
      .expect(200);
  });

  it('publie avec la direction seulement, une fois tout saisi, et prévient les familles', async () => {
    await http()
      .post('/api/resultats/publier')
      .set(avec('secretariat'))
      .send({ classeId, periodeId: t1 })
      .expect(403);
    const manque = await http()
      .post('/api/resultats/publier')
      .set(avec('admin'))
      .send({ classeId, periodeId: t1 })
      .expect(400);
    expect(manque.body.message).toMatch(/Fatou Test/);

    await http()
      .put('/api/resultats/generaux')
      .set(avec('principal'))
      .send({
        classeId,
        periodeId: t1,
        lignes: [{ eleveId: eleves[2], moyenne: 8.5 }],
      })
      .expect(200);
    const publie = await http()
      .post('/api/resultats/publier')
      .set(avec('admin'))
      .send({ classeId, periodeId: t1 })
      .expect(200);
    expect(publie.body).toMatchObject({ eleves: 3, famillesPrevenues: 3 });

    const sms = await prisma.notification.findFirstOrThrow({
      where: { ecoleId, eleveId: eleves[0], type: 'RESULTATS', canal: 'SMS' },
    });
    expect(sms.contenu).toBe(
      "Suivi_eleve : résultats de Awa (Trimestre 1) : moyenne 15,25/20, rang 1er sur 3. Bulletin dans l'application.",
    );
    const fatou = await prisma.notification.findFirstOrThrow({
      where: { ecoleId, eleveId: eleves[2], type: 'RESULTATS', canal: 'SMS' },
    });
    expect(fatou.contenu).toContain('rang non communiqué');

    // Republier ne renvoie rien.
    const encore = await http()
      .post('/api/resultats/publier')
      .set(avec('admin'))
      .send({ classeId, periodeId: t1 })
      .expect(200);
    expect(encore.body.famillesPrevenues).toBe(0);
  });

  it('verrouille la saisie des professeurs après publication', async () => {
    const { body } = await http()
      .put('/api/resultats/moyennes')
      .set(avec('profFrancais'))
      .send({
        classeId,
        periodeId: t1,
        matiereId: ids.francais,
        lignes: lignes([15]),
      })
      .expect(403);
    expect(body.message).toMatch(/déjà publiés/);
    await http()
      .put('/api/resultats/moyennes')
      .set(avec('secretariat'))
      .send({
        classeId,
        periodeId: t1,
        matiereId: ids.francais,
        lignes: lignes([15]),
      })
      .expect(200);
    // Le trimestre suivant reste ouvert.
    await http()
      .put('/api/resultats/moyennes')
      .set(avec('profFrancais'))
      .send({
        classeId,
        periodeId: t2,
        matiereId: ids.francais,
        lignes: lignes([11]),
      })
      .expect(200);
  });

  it('donne au parent les résultats publiés et le bulletin', async () => {
    const { body } = await http()
      .get(`/api/resultats/eleves/${eleves[0]}`)
      .set(avec('parentAwa'))
      .expect(200);
    expect(body.periodes[0]).toMatchObject({
      libelle: 'Trimestre 1',
      publie: true,
      resultat: { moyenne: 15.25, rang: 1, appreciation: 'Excellent travail' },
    });
    expect(
      body.periodes[0].matieres.map(
        (m: { matiere: { nom: string }; moyenne: number }) => [
          m.matiere.nom,
          m.moyenne,
        ],
      ),
    ).toEqual([
      ['Français', 15],
      ['Mathématiques', 16],
    ]);
    // Trimestre 2 saisi mais pas publié : rien pour le parent.
    expect(body.periodes[1]).toMatchObject({
      publie: false,
      resultat: null,
      matieres: [],
    });
    await http()
      .get(`/api/resultats/eleves/${eleves[1]}`)
      .set(avec('parentAwa'))
      .expect(403);

    const bulletin = await http()
      .get(`/api/resultats/eleves/${eleves[0]}/bulletins/${t1}`)
      .set(avec('parentAwa'))
      .buffer(true)
      .parse(pdf)
      .expect(200);
    expect(bulletin.headers['content-type']).toBe('application/pdf');
    expect((bulletin.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    await http()
      .get(`/api/resultats/eleves/${eleves[0]}/bulletins/${t2}`)
      .set(avec('parentAwa'))
      .expect(404);
    // Le personnel peut tirer un bulletin provisoire.
    await http()
      .get(`/api/resultats/eleves/${eleves[0]}/bulletins/${t2}`)
      .set(avec('principal'))
      .buffer(true)
      .parse(pdf)
      .expect(200);
  });

  it('saisit et publie les décisions de fin d’année', async () => {
    await http()
      .put('/api/resultats/decisions')
      .set(avec('profFrancais'))
      .send({ classeId, lignes: [{ eleveId: eleves[0], decision: 'ADMIS' }] })
      .expect(403);
    await http()
      .put('/api/resultats/decisions')
      .set(avec('principal'))
      .send({
        classeId,
        lignes: [
          { eleveId: eleves[0], decision: 'ADMIS', moyenneAnnuelle: 14.8 },
          { eleveId: eleves[1], decision: 'REDOUBLE' },
        ],
      })
      .expect(200);
    await http()
      .post('/api/resultats/decisions/publier')
      .set(avec('admin'))
      .send({ classeId })
      .expect(400);
    await http()
      .put('/api/resultats/decisions')
      .set(avec('principal'))
      .send({ classeId, lignes: [{ eleveId: eleves[2], decision: 'ADMIS' }] })
      .expect(200);
    const { body } = await http()
      .post('/api/resultats/decisions/publier')
      .set(avec('admin'))
      .send({ classeId })
      .expect(200);
    expect(body).toMatchObject({ eleves: 3, famillesPrevenues: 3 });
    const sms = await prisma.notification.findFirstOrThrow({
      where: {
        ecoleId,
        eleveId: eleves[1],
        type: 'DECISION_FIN_ANNEE',
        canal: 'SMS',
      },
    });
    expect(sms.contenu).toBe(
      "Suivi_eleve : décision de fin d'année pour Ali : redouble la classe.",
    );

    const vue = await http()
      .get(`/api/resultats/eleves/${eleves[0]}`)
      .set(avec('parentAwa'))
      .expect(200);
    expect(vue.body.decision).toMatchObject({
      decision: 'ADMIS',
      moyenneAnnuelle: 14.8,
    });
  });
});
