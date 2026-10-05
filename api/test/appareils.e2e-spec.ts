// Appareils des élèves sur une vraie base PostgreSQL (pnpm db:up && pnpm db:migrate).
// Le test crée sa propre école et la supprime à la fin.
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

// IMEI valides (clé de Luhn) propres à ce test.
function imei(): string {
  const debut = `35${randomInt(100_000_000_000, 999_999_999_999)}`;
  const somme = debut.split('').reduce((t, c, i) => {
    let n = Number(c);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    return t + n;
  }, 0);
  return `${debut}${(10 - (somme % 10)) % 10}`;
}

// Plus petite image PNG valide (1 × 1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Appareils (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ecoleId = randomUUID();
  const autreEcoleId = randomUUID();
  const jetons: Record<string, string> = {};
  let classeId: string;
  let awa: string;
  let ali: string;
  let eleveAutreEcole: string;
  const imeiAwa = imei();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    for (const id of [ecoleId, autreEcoleId]) {
      await prisma.ecole.create({
        data: { id, nom: `École appareils ${id.slice(-4)}` },
      });
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
    classeId = (
      await prisma.classe.create({
        data: { ecoleId, anneeScolaireId: annee.id, nom: '5e A', niveau: '5e' },
      })
    ).id;

    for (const role of [
      Role.SECRETARIAT,
      Role.ENSEIGNANT,
      Role.SURVEILLANT,
      Role.COMPTABLE,
    ]) {
      const u = await prisma.utilisateur.create({
        data: { ecoleId, prenoms: 'Test', nom: role, role },
      });
      jetons[role] = jwt.sign({ sub: u.id, role, ecoleId });
    }

    const eleve = async (prenoms: string, ecole: string, contact: number) => {
      const e = await prisma.eleve.create({
        data: {
          ecoleId: ecole,
          matricule: `APP-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2013-05-01'),
          classeId: ecole === ecoleId ? classeId : undefined,
        },
      });
      const t = await prisma.tuteur.create({
        data: {
          ecoleId: ecole,
          prenoms: 'Parent',
          nom: prenoms,
          contact1: `+22170${randomInt(1_000_000, 9_999_999)}${contact}`.slice(
            0,
            13,
          ),
          email: `${prenoms.toLowerCase()}-${randomUUID()}@test.sn`,
        },
      });
      await prisma.eleveTuteur.create({
        data: {
          eleveId: e.id,
          tuteurId: t.id,
          lien: LienTuteur.MERE,
          principal: true,
        },
      });
      return { eleve: e.id, tuteur: t.id };
    };
    const a = await eleve('Awa', ecoleId, 1);
    const b = await eleve('Ali', ecoleId, 2);
    eleveAutreEcole = (await eleve('Ailleurs', autreEcoleId, 3)).eleve;
    awa = a.eleve;
    ali = b.eleve;
    // Vrais comptes parents : les signalements enregistrent leur auteur.
    for (const [nom, tuteurId] of [
      ['parentAwa', a.tuteur],
      ['parentAli', b.tuteur],
    ]) {
      const parent = await prisma.utilisateur.create({
        data: {
          ecoleId,
          prenoms: 'Parent',
          nom,
          role: Role.PARENT,
          tuteur: { connect: { id: tuteurId } },
        },
      });
      jetons[nom] = jwt.sign({
        sub: parent.id,
        role: Role.PARENT,
        ecoleId,
        tuteurId,
      });
    }
  });

  afterAll(async () => {
    for (const id of [ecoleId, autreEcoleId]) {
      await prisma.notification.deleteMany({ where: { ecoleId: id } });
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
  const avec = (qui: string) => ({ Authorization: `Bearer ${jetons[qui]}` });
  const signaler = (id: string, qui: string, type: string, extra = {}) =>
    http()
      .post(`/api/appareils/${id}/signalements`)
      .set(avec(qui))
      .send({ type, ...extra });

  let telephone: { id: string; qrCode: string; codeCourt: string };

  describe('enregistrement', () => {
    it('enregistre un téléphone avec un IMEI saisi avec espaces', async () => {
      const espace = imeiAwa.replace(/(\d{5})(\d{5})(\d{5})/, '$1 $2 $3');
      const { body } = await http()
        .post('/api/appareils')
        .set(avec(Role.SECRETARIAT))
        .send({
          eleveId: awa,
          type: 'TELEPHONE',
          marque: 'Tecno',
          modele: 'Spark 20',
          couleur: 'bleu',
          imei: espace,
          signesDistinctifs: 'Autocollant étoile au dos',
        })
        .expect(201);
      telephone = body;
      expect(body).toMatchObject({
        imei: imeiAwa,
        statut: 'ACTIF',
        aPhoto: false,
        eleve: { id: awa, classe: { nom: '5e A' } },
      });
      expect(body.codeCourt).toMatch(/^[0-9A-F]{8}$/);
      expect(body).not.toHaveProperty('photoUrl');
    });

    it.each([
      [
        'IMEI à la clé fausse',
        () => ({
          eleveId: ali,
          type: 'TELEPHONE',
          imei: imeiAwa.slice(0, 14) + ((Number(imeiAwa[14]) + 1) % 10),
        }),
        400,
      ],
      [
        'IMEI déjà enregistré',
        () => ({ eleveId: ali, type: 'TELEPHONE', imei: imeiAwa }),
        409,
      ],
      [
        "élève d'une autre école",
        () => ({ eleveId: eleveAutreEcole, type: 'TABLETTE' }),
        400,
      ],
      ['type inconnu', () => ({ eleveId: ali, type: 'MONTRE' }), 400],
    ])('refuse : %s', async (_, corps, statut) => {
      await http()
        .post('/api/appareils')
        .set(avec(Role.SECRETARIAT))
        .send(corps())
        .expect(statut);
    });

    it("interdit l'enregistrement à un enseignant", async () => {
      await http()
        .post('/api/appareils')
        .set(avec(Role.ENSEIGNANT))
        .send({ eleveId: ali, type: 'TABLETTE' })
        .expect(403);
    });

    it('enregistre la tablette d’un autre élève', async () => {
      await http()
        .post('/api/appareils')
        .set(avec(Role.SECRETARIAT))
        .send({
          eleveId: ali,
          type: 'TABLETTE',
          marque: 'Lenovo',
          couleur: 'gris',
        })
        .expect(201);
    });
  });

  describe('recherche et scan', () => {
    it.each([
      ['fin de l’IMEI', () => imeiAwa.slice(-6)],
      ['code court', () => telephone.codeCourt.toLowerCase()],
      ['signe distinctif', () => 'étoile'],
      ['marque et couleur', () => 'tecno bleu'],
    ])('retrouve le téléphone par %s', async (_, q) => {
      const { body } = await http()
        .get(`/api/appareils?q=${encodeURIComponent(q())}`)
        .set(avec(Role.SURVEILLANT))
        .expect(200);
      expect(body.elements.map((a: { id: string }) => a.id)).toEqual([
        telephone.id,
      ]);
    });

    it('le parent ne voit que les appareils de ses enfants', async () => {
      const { body } = await http()
        .get('/api/appareils')
        .set(avec('parentAli'))
        .expect(200);
      expect(body.total).toBe(1);
      expect(body.elements[0].eleve.id).toBe(ali);
      await http()
        .get(`/api/appareils/${telephone.id}`)
        .set(avec('parentAli'))
        .expect(404);
    });

    it('le scan montre le propriétaire et ses tuteurs au personnel seulement', async () => {
      const complet = await http()
        .get(`/api/appareils/qr/${telephone.qrCode}`)
        .set(avec(Role.ENSEIGNANT))
        .expect(200);
      expect(complet.body.eleve.prenoms).toBe('Awa');
      expect(complet.body.tuteurs[0]).toMatchObject({
        prenoms: 'Parent',
        principal: true,
      });

      const court = await http()
        .get(`/api/appareils/qr/${telephone.codeCourt}`)
        .set(avec(Role.SURVEILLANT))
        .expect(200);
      expect(court.body.id).toBe(telephone.id);

      await http()
        .get(`/api/appareils/qr/${telephone.qrCode}`)
        .set(avec('parentAwa'))
        .expect(403);
      await http()
        .get('/api/appareils/qr/inconnu')
        .set(avec(Role.SURVEILLANT))
        .expect(404);
    });
  });

  describe('signalements', () => {
    const notifications = (type: string) =>
      prisma.notification.count({
        where: { ecoleId, eleveId: awa, type: type as never },
      });

    it('suit la vie de l’appareil et prévient la famille', async () => {
      // Le parent déclare la perte : pas de notification à lui-même.
      const perdu = await signaler(telephone.id, 'parentAwa', 'DECLARE_PERDU', {
        commentaire: 'Oublié dans le bus',
      }).expect(201);
      expect(perdu.body.statut).toBe('PERDU');
      expect(await notifications('APPAREIL')).toBe(0);

      await signaler(telephone.id, 'parentAwa', 'TROUVE').expect(403);
      await signaler(telephone.id, Role.COMPTABLE, 'CONFISQUE').expect(403);

      const trouve = await signaler(telephone.id, Role.ENSEIGNANT, 'TROUVE', {
        lieu: 'Cour de récréation',
      }).expect(201);
      expect(trouve.body.statut).toBe('TROUVE');
      expect(await notifications('APPAREIL')).toBe(1);
      const notif = await prisma.notification.findFirstOrThrow({
        where: { ecoleId, eleveId: awa, type: 'APPAREIL' },
      });
      expect(notif).toMatchObject({ canal: 'EMAIL', statut: 'EN_FILE' });
      expect(notif.contenu).toMatch(
        /téléphone Tecno Spark 20 bleu de Awa a été trouvé.*Cour de récréation/,
      );

      await signaler(telephone.id, Role.ENSEIGNANT, 'RESTITUE').expect(403);
      const rendu = await signaler(
        telephone.id,
        Role.SURVEILLANT,
        'RESTITUE',
      ).expect(201);
      expect(rendu.body.statut).toBe('RESTITUE');

      await signaler(telephone.id, Role.ENSEIGNANT, 'CONFISQUE').expect(201);
      await signaler(telephone.id, Role.ENSEIGNANT, 'CONFISQUE').expect(400);
      const final = await signaler(
        telephone.id,
        Role.SURVEILLANT,
        'RESTITUE',
      ).expect(201);
      expect(final.body.incidents.map((i: { type: string }) => i.type)).toEqual(
        ['RESTITUE', 'CONFISQUE', 'RESTITUE', 'TROUVE', 'DECLARE_PERDU'],
      );
    });

    it('crée un comportement négatif au 3e usage en classe du mois, une seule fois', async () => {
      const resultats: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        const { body } = await signaler(
          telephone.id,
          Role.ENSEIGNANT,
          'USAGE_EN_CLASSE',
        ).expect(201);
        expect(body.statut).toBe('RESTITUE');
        resultats.push(body.comportementCree);
      }
      expect(resultats).toEqual([false, false, true, false]);
      const comportements = await prisma.comportement.findMany({
        where: { eleveId: awa },
      });
      expect(comportements).toHaveLength(1);
      expect(comportements[0]).toMatchObject({
        type: 'NEGATIF',
        categorie: 'USAGE_APPAREIL',
        statut: 'VALIDE',
      });
      expect(await notifications('USAGE_APPAREIL')).toBe(4);
      const sms = await prisma.notification.findFirstOrThrow({
        where: { ecoleId, eleveId: awa, type: 'COMPORTEMENT', canal: 'SMS' },
      });
      expect(sms.contenu.length).toBeLessThanOrEqual(160);
      expect(sms.priorite).toBe('HAUTE');
    });
  });

  describe('photo et étiquettes', () => {
    it('enregistre et sert la photo, refuse un faux fichier image', async () => {
      const { body } = await http()
        .post(`/api/appareils/${telephone.id}/photo`)
        .set(avec(Role.SECRETARIAT))
        .attach('photo', PNG, 'photo.png')
        .expect(201);
      expect(body.aPhoto).toBe(true);

      const photo = await http()
        .get(`/api/appareils/${telephone.id}/photo`)
        .set(avec('parentAwa'))
        .expect(200);
      expect(photo.headers['content-type']).toBe('image/png');
      await http()
        .get(`/api/appareils/${telephone.id}/photo`)
        .set(avec('parentAli'))
        .expect(404);

      await http()
        .post(`/api/appareils/${telephone.id}/photo`)
        .set(avec(Role.SECRETARIAT))
        .attach('photo', Buffer.from('pas une image'), 'photo.png')
        .expect(400);
    });

    it('produit une planche PDF pour une classe', async () => {
      const pdf = await http()
        .get(`/api/appareils/etiquettes?classeId=${classeId}`)
        .set(avec(Role.SURVEILLANT))
        .buffer(true)
        .parse((res, fin) => {
          const morceaux: Buffer[] = [];
          res.on('data', (m: Buffer) => morceaux.push(m));
          res.on('end', () => fin(null, Buffer.concat(morceaux)));
        })
        .expect(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

      await http()
        .get('/api/appareils/etiquettes')
        .set(avec(Role.SURVEILLANT))
        .expect(400);
      await http()
        .get(`/api/appareils/etiquettes?classeId=${classeId}`)
        .set(avec(Role.ENSEIGNANT))
        .expect(403);
    });
  });
});
