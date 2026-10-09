// Revue de sécurité automatisée : contrôle d'accès de chaque route, cloisonnement
// des familles, limitation des tentatives, en-têtes, consentement, export et effacement.
import { INestApplication, RequestMethod } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { altcha } from './connexion.js';
import { configurerApplication } from '../src/app.setup.js';
import { CLE_PARAM_ELEVE } from '../src/auth/decorators/param-eleve.decorator.js';
import { CLE_PUBLIC } from '../src/auth/decorators/public.decorator.js';
import { CLE_ROLES } from '../src/auth/decorators/roles.decorator.js';
import { ParentOwnsEleveGuard } from '../src/auth/guards/parent-owns-eleve.guard.js';
import { VERSION_CONSENTEMENT } from '../src/auth/consentement.js';
import { Genre, LienTuteur, Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.BULLMQ_PREFIXE = `e2e-securite-${randomUUID()}`;

/**
 * Routes ouvertes à tout utilisateur connecté (sans @Roles), chacune pour une
 * raison vérifiée ici ou dans son module. Toute nouvelle route sans @Roles fait
 * échouer le test : il faut soit lui donner des rôles, soit la justifier ici.
 */
const OUVERTES_A_TOUS_CONNECTES = [
  'GET /api/auth/moi', // son propre profil
  'GET /api/eleves', // parent : filtré sur ses enfants dans le service
  'GET /api/eleves/:id', // ParentOwnsEleveGuard
  'GET /api/appareils', // parent : filtré sur ses enfants dans le service
  'GET /api/appareils/:id', // parent : vérifié dans le service (404 sinon)
  'GET /api/appareils/:id/photo', // idem
  'POST /api/appareils/:id/signalements', // droits par type de signalement et rôle
  'POST /api/notifications/jetons-push', // son propre appareil
  'DELETE /api/notifications/jetons-push', // idem
].sort();

interface Route {
  methode: string;
  chemin: string;
  publique: boolean;
  roles: Role[] | undefined;
  paramEleve: string | null;
}

const VERBES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

const joindre = (...parts: string[]) =>
  `/${parts
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/')}`;

describe('Sécurité (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const routes: Route[] = [];
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  const eleves: Record<string, { id: string; matricule: string }> = {};
  const tuteurs: Record<string, { id: string; contact: string }> = {};
  let rafraichissementParent = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    // Inventaire de toutes les routes déclarées dans les contrôleurs.
    for (const wrapper of app.get(DiscoveryService).getControllers()) {
      const classe = wrapper.metatype as (new (...a: never[]) => object) | null;
      if (!classe) continue;
      const base = String(
        [Reflect.getMetadata('path', classe)].flat()[0] ?? '',
      );
      const publiqueClasse = Reflect.getMetadata(CLE_PUBLIC, classe) === true;
      const rolesClasse = Reflect.getMetadata(CLE_ROLES, classe) as
        Role[] | undefined;
      for (const nom of Object.getOwnPropertyNames(classe.prototype)) {
        const methode = (classe.prototype as Record<string, unknown>)[nom];
        if (nom === 'constructor' || typeof methode !== 'function') continue;
        const verbe = Reflect.getMetadata('method', methode) as
          number | undefined;
        if (verbe === undefined) continue;
        const gardes = (Reflect.getMetadata('__guards__', methode) ??
          []) as unknown[];
        routes.push({
          methode: VERBES[verbe],
          chemin: joindre(
            'api',
            base,
            String([Reflect.getMetadata('path', methode)].flat()[0] ?? ''),
          ),
          publique:
            publiqueClasse || Reflect.getMetadata(CLE_PUBLIC, methode) === true,
          roles:
            (Reflect.getMetadata(CLE_ROLES, methode) as Role[] | undefined) ??
            rolesClasse,
          paramEleve: gardes.includes(ParentOwnsEleveGuard)
            ? ((Reflect.getMetadata(CLE_PARAM_ELEVE, methode) as
                string | undefined) ?? 'eleveId')
            : null,
        });
      }
    }

    // Une école, deux familles, le personnel.
    await prisma.ecole.create({ data: { id: ecoleId, nom: 'École sécurité' } });
    for (const prenoms of ['Awa', 'Ali']) {
      const contact = `+22175${randomInt(1_000_000, 9_999_999)}`.replace(
        /0$/,
        '1',
      );
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `SEC-${randomInt(100000, 999999)}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2012-05-10'),
          tuteurs: {
            create: {
              lien: LienTuteur.MERE,
              principal: true,
              tuteur: {
                create: {
                  ecoleId,
                  prenoms: `Parent ${prenoms}`,
                  nom: 'Test',
                  contact1: contact,
                },
              },
            },
          },
        },
        include: { tuteurs: true },
      });
      eleves[prenoms] = { id: e.id, matricule: e.matricule };
      tuteurs[prenoms] = { id: e.tuteurs[0].tuteurId, contact };
    }
    const motDePasseHash = await hash('Mot-de-passe-1');
    for (const [cle, role] of [
      ['direction', Role.ADMIN],
      ['secretariat', Role.SECRETARIAT],
    ] as const) {
      const u = await prisma.utilisateur.create({
        data: {
          ecoleId,
          prenoms: cle,
          nom: 'Test',
          role,
          email: `${cle}-${randomUUID()}@securite.test`,
          motDePasseHash,
        },
      });
      jetons[cle] = jwt.sign({ sub: u.id, role, ecoleId });
    }
  });

  afterAll(async () => {
    await prisma.journalAudit.deleteMany({ where: { ecoleId } });
    await prisma.notification.deleteMany({ where: { ecoleId } });
    await prisma.eleve.deleteMany({ where: { ecoleId } });
    await prisma.tuteur.deleteMany({ where: { ecoleId } });
    await prisma.utilisateur.deleteMany({ where: { ecoleId } });
    await prisma.ecole.delete({ where: { id: ecoleId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const avec = (qui: string) => ({ Authorization: `Bearer ${jetons[qui]}` });
  const appeler = (methode: string, chemin: string) => {
    const r = http();
    switch (methode) {
      case 'POST':
        return r.post(chemin);
      case 'PUT':
        return r.put(chemin);
      case 'PATCH':
        return r.patch(chemin);
      case 'DELETE':
        return r.delete(chemin);
      default:
        return r.get(chemin);
    }
  };
  const remplir = (chemin: string, valeurs: Record<string, string> = {}) =>
    chemin.replace(/:(\w+)/g, (_, nom: string) => valeurs[nom] ?? randomUUID());

  it("a trouvé toutes les routes de l'API", () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(routes.filter((r) => r.publique).map((r) => r.chemin)).toEqual(
      expect.arrayContaining(['/api/auth/connexion', '/api/sante']),
    );
  });

  it('refuse toute route non publique sans jeton (401)', async () => {
    const acceptees: string[] = [];
    for (const r of routes.filter((x) => !x.publique)) {
      const reponse = await appeler(r.methode, remplir(r.chemin));
      if (reponse.status !== 401)
        acceptees.push(`${r.methode} ${r.chemin} → ${reponse.status}`);
    }
    expect(acceptees).toEqual([]);
  });

  it('exige des rôles explicites, sauf routes justifiées', () => {
    const sansRoles = routes
      .filter((r) => !r.publique && !r.roles?.length)
      .map((r) => `${r.methode} ${r.chemin}`)
      .sort();
    expect(sansRoles).toEqual(OUVERTES_A_TOUS_CONNECTES);
  });

  it('cloisonne le concepteur et les écoles', async () => {
    // Concepteur : sans école. Il n'entre que sur ses routes (et son profil).
    const concepteur = {
      Authorization: `Bearer ${app.get(JwtService).sign({ sub: randomUUID(), role: Role.SUPER_ADMIN, ecoleId: '' })}`,
    };
    const ouvertesAuConcepteur = ['GET /api/auth/moi'];
    const fuites: string[] = [];
    for (const r of routes.filter((x) => !x.publique)) {
      const cle = `${r.methode} ${r.chemin}`;
      const reserveeAuConcepteur =
        r.roles?.length === 1 && r.roles[0] === Role.SUPER_ADMIN;
      if (reserveeAuConcepteur) {
        // La direction d'une école n'entre jamais dans l'espace concepteur.
        const reponse = await appeler(r.methode, remplir(r.chemin)).set(
          avec('direction'),
        );
        if (reponse.status !== 403)
          fuites.push(`direction ${cle} → ${reponse.status}`);
      } else if (
        !r.roles?.includes(Role.SUPER_ADMIN) &&
        !ouvertesAuConcepteur.includes(cle)
      ) {
        const reponse = await appeler(r.methode, remplir(r.chemin)).set(
          concepteur,
        );
        if (reponse.status !== 403)
          fuites.push(`concepteur ${cle} → ${reponse.status}`);
      }
    }
    expect(fuites).toEqual([]);
    expect(
      routes.filter((r) => r.roles?.includes(Role.SUPER_ADMIN)).length,
    ).toBeGreaterThan(5);
  });

  describe('cloisonnement des familles', () => {
    beforeAll(async () => {
      // Connexion réelle du parent d'Awa (code lu en base après remplacement).
      const otp = await http()
        .post('/api/auth/otp/demande')
        .send({ telephone: tuteurs.Awa.contact, altcha: altcha() })
        .expect(202);
      expect(otp.body.message).toBeDefined();
      const code = '123456';
      await prisma.codeOtp.updateMany({
        where: { telephone: tuteurs.Awa.contact, consommeLe: null },
        data: { codeHash: await hash(code) },
      });
      const session = await http()
        .post('/api/auth/otp/verification')
        .set('X-Forwarded-For', '203.0.113.9')
        .send({ telephone: tuteurs.Awa.contact, code })
        .expect(200);
      jetons.parent = session.body.jetonAcces;
      rafraichissementParent = session.body.jetonRafraichissement;
    });

    it("refuse au parent toutes les routes portant l'id d'un autre enfant (403)", async () => {
      const gardees = routes.filter((r) => r.paramEleve);
      expect(gardees.length).toBeGreaterThanOrEqual(3);
      const ouvertes: string[] = [];
      for (const r of gardees) {
        const reponse = await appeler(
          r.methode,
          remplir(r.chemin, { [r.paramEleve!]: eleves.Ali.id }),
        ).set(avec('parent'));
        if (reponse.status !== 403)
          ouvertes.push(`${r.methode} ${r.chemin} → ${reponse.status}`);
      }
      expect(ouvertes).toEqual([]);
    });

    it.each([
      '/api/absences',
      '/api/comportements',
      '/api/rappels-paiement',
      '/api/appareils',
    ])('ne renvoie rien de l’autre famille : %s', async (chemin) => {
      const { body } = await http()
        .get(chemin)
        .query({ eleveId: eleves.Ali.id })
        .set(avec('parent'));
      expect(body.elements ?? []).toEqual([]);
    });

    it("journalise la connexion avec l'IP réelle transmise par le proxy", async () => {
      const ligne = await prisma.journalAudit.findFirst({
        where: { ecoleId, action: 'CONNEXION' },
        orderBy: { creeLe: 'desc' },
      });
      expect(ligne?.ip).toBe('203.0.113.9');
    });

    it('demande puis enregistre le consentement du tuteur', async () => {
      const avant = await http()
        .get('/api/auth/moi')
        .set(avec('parent'))
        .expect(200);
      expect(avant.body.consentement).toMatchObject({
        version: VERSION_CONSENTEMENT,
        accepte: false,
      });
      expect(avant.body.consentement.texte.length).toBeGreaterThan(2);
      await http()
        .post('/api/auth/consentement')
        .set(avec('parent'))
        .send({ version: '2000-01' })
        .expect(400);
      const apres = await http()
        .post('/api/auth/consentement')
        .set(avec('parent'))
        .send({ version: VERSION_CONSENTEMENT })
        .expect(200);
      expect(apres.body.consentement.accepte).toBe(true);
      const tuteur = await prisma.tuteur.findUniqueOrThrow({
        where: { id: tuteurs.Awa.id },
      });
      expect(tuteur.consentementVersion).toBe(VERSION_CONSENTEMENT);
      expect(tuteur.consentementLe).not.toBeNull();
      // Le personnel n'a pas de consentement à donner.
      await http()
        .post('/api/auth/consentement')
        .set(avec('secretariat'))
        .send({ version: VERSION_CONSENTEMENT })
        .expect(403);
    });
  });

  describe('limitation des tentatives', () => {
    it('bloque après 10 essais de mot de passe sur un même compte (429)', async () => {
      const email = `inconnu-${randomUUID()}@securite.test`;
      for (let i = 0; i < 10; i++) {
        await http()
          .post('/api/auth/connexion')
          .send({ email, motDePasse: 'mauvais', altcha: altcha() })
          .expect(401);
      }
      const { body } = await http()
        .post('/api/auth/connexion')
        .send({ email, motDePasse: 'mauvais', altcha: altcha() })
        .expect(429);
      expect(body.message).toContain('Réessayez dans 15 minutes');
    });

    it('bloque après 10 demandes de code depuis une même IP (429)', async () => {
      const ip = '198.51.100.7';
      for (let i = 0; i < 10; i++) {
        await http()
          .post('/api/auth/otp/demande')
          .set('X-Forwarded-For', ip)
          .send({
            telephone: `+22170${randomInt(1_000_000, 9_999_999)}1`,
            altcha: altcha(),
          })
          .expect(202);
      }
      await http()
        .post('/api/auth/otp/demande')
        .set('X-Forwarded-For', ip)
        .send({
          telephone: `+22170${randomInt(1_000_000, 9_999_999)}1`,
          altcha: altcha(),
        })
        .expect(429);
      // Une autre adresse n'est pas touchée.
      await http()
        .post('/api/auth/otp/demande')
        .set('X-Forwarded-For', '198.51.100.8')
        .send({
          telephone: `+22170${randomInt(1_000_000, 9_999_999)}1`,
          altcha: altcha(),
        })
        .expect(202);
    });
  });

  it('envoie les en-têtes de sécurité', async () => {
    const r = await http().get('/api/sante').expect(200);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  describe("données d'un élève sur demande", () => {
    it('exporte toutes les données (direction seulement, journalisé)', async () => {
      await http()
        .get(`/api/eleves/${eleves.Awa.id}/donnees`)
        .set(avec('secretariat'))
        .expect(403);
      const r = await http()
        .get(`/api/eleves/${eleves.Awa.id}/donnees`)
        .set(avec('direction'))
        .expect(200);
      expect(r.headers['content-disposition']).toContain(
        `donnees-${eleves.Awa.matricule}`,
      );
      const donnees = JSON.parse(r.text);
      expect(donnees.eleve).toMatchObject({ prenoms: 'Awa', nom: 'Test' });
      expect(donnees.eleve.tuteurs[0].tuteur).toMatchObject({
        prenoms: 'Parent Awa',
        contact1: tuteurs.Awa.contact,
        consentementVersion: VERSION_CONSENTEMENT,
      });
      expect(
        await prisma.journalAudit.count({
          where: { ecoleId, action: 'EXPORT', entiteId: eleves.Awa.id },
        }),
      ).toBe(1);
    });

    it("n'efface qu'un élève archivé, avec le matricule en confirmation", async () => {
      const chemin = `/api/eleves/${eleves.Awa.id}/effacer`;
      await http()
        .post(chemin)
        .set(avec('direction'))
        .send({ confirmation: eleves.Awa.matricule })
        .expect(400);
      await http()
        .post(`/api/eleves/${eleves.Awa.id}/archiver`)
        .set(avec('direction'))
        .send({ motif: 'Départ de la famille' })
        .expect(201);
      await http()
        .post(chemin)
        .set(avec('secretariat'))
        .send({ confirmation: eleves.Awa.matricule })
        .expect(403);
      await http()
        .post(chemin)
        .set(avec('direction'))
        .send({ confirmation: 'SE-0000-0000' })
        .expect(400);
      const { body } = await http()
        .post(chemin)
        .set(avec('direction'))
        .send({ confirmation: eleves.Awa.matricule.toLowerCase() })
        .expect(200);
      expect(body).toEqual({ efface: true, tuteursAnonymises: 1 });
    });

    it("anonymise l'élève et son tuteur, et ferme le compte du parent", async () => {
      const eleve = await prisma.eleve.findUniqueOrThrow({
        where: { id: eleves.Awa.id },
        include: { tuteurs: true },
      });
      expect(eleve).toMatchObject({ prenoms: 'Élève', nom: 'effacé' });
      expect(eleve.dateNaissance.toISOString()).toBe(
        '2012-01-01T00:00:00.000Z',
      );
      expect(eleve.tuteurs).toEqual([]);
      const tuteur = await prisma.tuteur.findUniqueOrThrow({
        where: { id: tuteurs.Awa.id },
        include: { utilisateur: true },
      });
      expect(tuteur).toMatchObject({
        nom: 'effacé',
        contact2: null,
        email: null,
      });
      expect(tuteur.contact1).not.toBe(tuteurs.Awa.contact);
      expect(tuteur.utilisateur).toMatchObject({
        actif: false,
        telephone: null,
      });
      await http()
        .post('/api/auth/rafraichir')
        .send({ jetonRafraichissement: rafraichissementParent })
        .expect(401);
      // L'autre famille n'est pas touchée.
      const ali = await prisma.eleve.findUniqueOrThrow({
        where: { id: eleves.Ali.id },
      });
      expect(ali.prenoms).toBe('Ali');
      // L'élève reste (jamais de suppression définitive) ; un second effacement est refusé.
      await http()
        .post(`/api/eleves/${eleves.Awa.id}/effacer`)
        .set(avec('direction'))
        .send({ confirmation: eleves.Awa.matricule })
        .expect(400);
    });
  });
});
