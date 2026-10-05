// Moteur de notifications sur PostgreSQL + Redis, avec fournisseurs simulés :
// le principal échoue pour les numéros finissant par 0000, le secours pour 00000.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurerApplication } from '../src/app.setup.js';
import {
  Genre,
  LienTuteur,
  Role,
  StatutEleve,
} from '../src/generated/prisma/enums.js';
import { ENVOIS_SIMULES } from '../src/notifications/fournisseurs/fournisseurs.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Files propres à ce fichier : aucun autre test ne traite nos envois.
process.env.BULLMQ_PREFIXE = `e2e-notif-${randomUUID()}`;

// Trois chiffres sans 0 final : le suffixe d'échec simulé reste exactement celui voulu.
const trois = () => `${randomInt(10, 99)}${randomInt(1, 9)}`;
const numero = () =>
  `+22177${trois()}${randomInt(1000, 9999)}`.replace(/0$/, '1');

/** Attend qu'une condition sur la base soit vraie (les envois sont asynchrones). */
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

describe('Moteur de notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let service: NotificationsService;
  const ecoleId = randomUUID();
  const jetons: Record<string, string> = {};
  const t: Record<string, { id: string; contact1: string; contact2?: string }> =
    {};
  let classeA: string;
  let classeB: string;
  let awa: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    service = app.get(NotificationsService);
    const jwt = app.get(JwtService);

    await prisma.ecole.create({
      data: { id: ecoleId, nom: 'École des notifications' },
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
        data: { ecoleId, anneeScolaireId: annee.id, nom, niveau: '6e' },
      });
    classeA = (await classe('6e A')).id;
    classeB = (await classe('6e B')).id;

    const tuteur = async (
      cle: string,
      contact1: string,
      extra: { email?: string; contact2?: string } = {},
    ) => {
      const cree = await prisma.tuteur.create({
        data: { ecoleId, prenoms: cle, nom: 'Test', contact1, ...extra },
      });
      t[cle] = { id: cree.id, contact1, contact2: extra.contact2 };
    };
    await tuteur('Malick', numero(), {
      email: `malick-${randomUUID()}@test.sn`,
      contact2: numero(),
    });
    await tuteur('Astou', numero());
    await tuteur('Omar', `+22176${trois()}0000`);
    await tuteur('Penda', `+2217${trois()}00000`, { contact2: numero() });
    await tuteur('Ancien', numero());

    const eleve = async (
      prenoms: string,
      classeId: string,
      tuteurs: string[],
      statut: StatutEleve = StatutEleve.ACTIF,
    ) => {
      const e = await prisma.eleve.create({
        data: {
          ecoleId,
          matricule: `NOTIF-${randomUUID()}`,
          prenoms,
          nom: 'Test',
          genre: Genre.FEMININ,
          dateNaissance: new Date('2014-01-01'),
          classeId,
          statut,
        },
      });
      for (const [i, cle] of tuteurs.entries()) {
        await prisma.eleveTuteur.create({
          data: {
            eleveId: e.id,
            tuteurId: t[cle].id,
            lien: LienTuteur.AUTRE,
            principal: i === 0,
          },
        });
      }
      return e.id;
    };
    awa = await eleve('Awa', classeA, ['Malick', 'Astou']);
    await eleve('Ali', classeA, ['Malick']);
    await eleve('Khady', classeB, ['Omar']);
    await eleve('Moussa', classeB, ['Penda']);
    await eleve('Partie', classeA, ['Ancien'], StatutEleve.ARCHIVE);

    // Malick a un compte parent et l'application installée.
    const parent = await prisma.utilisateur.create({
      data: {
        ecoleId,
        prenoms: 'Malick',
        nom: 'Test',
        role: Role.PARENT,
        tuteur: { connect: { id: t.Malick.id } },
        jetonsPush: {
          create: { jeton: `jeton-${randomUUID()}`, plateforme: 'ANDROID' },
        },
      },
    });
    jetons.parent = jwt.sign({
      sub: parent.id,
      role: Role.PARENT,
      ecoleId,
      tuteurId: t.Malick.id,
    });
    const autreParent = await prisma.utilisateur.create({
      data: {
        ecoleId,
        prenoms: 'Astou',
        nom: 'Test',
        role: Role.PARENT,
        tuteur: { connect: { id: t.Astou.id } },
      },
    });
    jetons.autreParent = jwt.sign({
      sub: autreParent.id,
      role: Role.PARENT,
      ecoleId,
      tuteurId: t.Astou.id,
    });
    const secretariat = await prisma.utilisateur.create({
      data: { ecoleId, prenoms: 'Coumba', nom: 'Test', role: Role.SECRETARIAT },
    });
    jetons.secretariat = jwt.sign({
      sub: secretariat.id,
      role: Role.SECRETARIAT,
      ecoleId,
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { ecoleId } });
    await prisma.modeleMessage.deleteMany({ where: { ecoleId } });
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
  const lignes = (where: object) =>
    prisma.notification.findMany({
      where: { ecoleId, ...where },
      orderBy: { creeLe: 'asc' },
    });
  /** Attend que tous les envois d'une source aient fini (envoyés ou abandonnés). */
  const traites = (sourceId: string) =>
    attendre(
      () => lignes({ sourceId, canal: { not: 'APPLICATION' } }),
      (l) => l.length > 0 && l.every((n) => n.statut !== 'EN_FILE'),
    );

  it('prévient chaque famille de la classe une seule fois, sur tous les canaux', async () => {
    const source = randomUUID();
    const resultat = await service.notifier({
      ecoleId,
      type: 'LIBERATION_ANTICIPEE',
      cible: { classeIds: [classeA] },
      variables: { heure: '11h00', motif: "coupure d'électricité" },
      sourceId: source,
    });
    // Malick (Awa et Ali) et Astou (Awa) ; l'élève archivé est ignoré.
    expect(resultat.tuteurs).toBe(2);

    const envoyees = await traites(source);
    const deMalick = envoyees.filter((n) => n.tuteurId === t.Malick.id);
    expect(deMalick.map((n) => n.canal).sort()).toEqual([
      'EMAIL',
      'PUSH',
      'SMS',
    ]);
    expect(
      deMalick.every((n) => n.statut === 'ENVOYEE' && n.priorite === 'URGENTE'),
    ).toBe(true);

    const sms = deMalick.find((n) => n.canal === 'SMS')!;
    expect(sms.contenu).toBe(
      "Suivi_eleve : les élèves de 6e A sont libérés à 11h00 (coupure d'électricité). Merci de prendre vos dispositions.",
    );
    expect(ENVOIS_SIMULES).toContainEqual(
      expect.objectContaining({
        destinataire: t.Malick.contact1,
        texte: sms.contenu,
      }),
    );
    const email = deMalick.find((n) => n.canal === 'EMAIL')!;
    expect(email.sujet).toBe('Libération anticipée – 6e A');
    expect(email.contenu).toContain('Bonjour Malick,');
    // Prénoms des enfants concernés, dans l'ordre alphabétique.
    expect(email.contenu).toContain('pour Ali et Awa.');

    // Astou n'a ni email ni application : SMS seulement, plus l'historique.
    const dAstou = await lignes({ sourceId: source, tuteurId: t.Astou.id });
    expect(dAstou.map((n) => n.canal).sort()).toEqual(['APPLICATION', 'SMS']);
    expect(
      await lignes({ sourceId: source, tuteurId: t.Ancien.id }),
    ).toHaveLength(0);
  });

  it('bascule sur le SMS de secours, puis sur Contact_tuteur_2', async () => {
    const source = randomUUID();
    await service.notifier({
      ecoleId,
      type: 'PAS_DE_COURS',
      cible: { classeIds: [classeB] },
      variables: { date: '07/10/2026', creneau: 'matin', motif: 'grève' },
      sourceId: source,
    });

    // Omar : le principal échoue, le secours envoie.
    const omar = await attendre(
      () => lignes({ sourceId: source, tuteurId: t.Omar.id, canal: 'SMS' }),
      (l) => l[0]?.statut === 'ENVOYEE',
    );
    expect(omar[0].fournisseur).toBe('simulation-secours');

    // Penda : les deux échouent 3 fois, puis le message part sur Contact_tuteur_2.
    const penda = await attendre(
      () => lignes({ sourceId: source, tuteurId: t.Penda.id, canal: 'SMS' }),
      (l) => l.length === 2 && l[1].statut === 'ENVOYEE',
    );
    expect(penda[0]).toMatchObject({
      destinataire: t.Penda.contact1,
      statut: 'ECHOUEE',
      essais: 3,
    });
    expect(penda[0].erreur).toMatch(/échec simulé/);
    expect(penda[1]).toMatchObject({
      destinataire: t.Penda.contact2,
      lotId: penda[0].lotId,
    });
  });

  it('applique les préférences du parent, sauf pour les messages obligatoires', async () => {
    const { body } = await http()
      .put('/api/notifications/preferences')
      .set(avec('parent'))
      .send({
        preferences: [
          { type: 'EVENEMENT', sms: false, email: false, push: true },
          {
            type: 'LIBERATION_ANTICIPEE',
            sms: false,
            email: false,
            push: false,
          },
        ],
      })
      .expect(200);
    expect(
      body.find((p: { type: string }) => p.type === 'EVENEMENT'),
    ).toMatchObject({
      sms: false,
      email: false,
      push: true,
    });
    expect(
      body.find((p: { type: string }) => p.type === 'LIBERATION_ANTICIPEE'),
    ).toMatchObject({
      obligatoire: true,
      sms: true,
    });

    const source = randomUUID();
    await service.notifier({
      ecoleId,
      type: 'EVENEMENT',
      cible: { ecole: true },
      variables: {
        titre: 'Kermesse',
        date: '15/11/2026',
        lieu: 'cour',
        details: 'Venez nombreux.',
      },
      sourceId: source,
    });
    const deMalick = await lignes({ sourceId: source, tuteurId: t.Malick.id });
    expect(deMalick.map((n) => n.canal).sort()).toEqual([
      'APPLICATION',
      'PUSH',
    ]);
  });

  it('met à jour le journal avec les accusés de livraison', async () => {
    const [sms] = await lignes({
      tuteurId: t.Astou.id,
      canal: 'SMS',
      statut: 'ENVOYEE',
    });
    await http()
      .post('/api/notifications/webhooks/twilio?jeton=faux')
      .type('form')
      .send({
        MessageSid: sms.referenceFournisseur,
        MessageStatus: 'delivered',
      })
      .expect(401);
    await http()
      .post('/api/notifications/webhooks/twilio?jeton=secret-webhook-e2e')
      .type('form')
      .send({
        MessageSid: sms.referenceFournisseur,
        MessageStatus: 'delivered',
      })
      .expect(204);
    const apres = await prisma.notification.findUniqueOrThrow({
      where: { id: sms.id },
    });
    expect(apres.statut).toBe('DELIVREE');
    expect(apres.delivreeLe).not.toBeNull();

    // Un « non délivré » sur Contact_tuteur_1 relance vers Contact_tuteur_2 (Malick en a un).
    const [smsMalick] = await lignes({
      tuteurId: t.Malick.id,
      canal: 'SMS',
      statut: 'ENVOYEE',
    });
    await http()
      .post('/api/notifications/webhooks/brevo?jeton=secret-webhook-e2e')
      .send({ event: 'delivered', 'message-id': 'inconnu' })
      .expect(204);
    await http()
      .post('/api/notifications/webhooks/twilio?jeton=secret-webhook-e2e')
      .type('form')
      .send({
        MessageSid: smsMalick.referenceFournisseur,
        MessageStatus: 'undelivered',
        ErrorCode: '30003',
      })
      .expect(204);
    const relance = await attendre(
      () => lignes({ lotId: smsMalick.lotId, canal: 'SMS' }),
      (l) => l.length === 2 && l[1].statut === 'ENVOYEE',
    );
    expect(relance[0]).toMatchObject({
      statut: 'ECHOUEE',
      erreur: 'Twilio, code 30003',
    });
    expect(relance[1].destinataire).toBe(t.Malick.contact2);
  });

  it("donne au parent son historique et l'accusé de lecture", async () => {
    const { body } = await http()
      .get('/api/notifications/mes')
      .set(avec('parent'))
      .expect(200);
    expect(body.total).toBeGreaterThanOrEqual(2);
    const nonLuesAvant = body.nonLues;
    const premiere = body.elements[0];
    expect(premiere).toMatchObject({
      type: 'EVENEMENT',
      sujet: 'Kermesse – 15/11/2026',
      lueLe: null,
    });

    await http()
      .post(`/api/notifications/${premiere.id}/lue`)
      .set(avec('autreParent'))
      .expect(404);
    await http()
      .post(`/api/notifications/${premiere.id}/lue`)
      .set(avec('parent'))
      .expect(200);
    const apres = await http()
      .get('/api/notifications/mes')
      .set(avec('parent'))
      .expect(200);
    expect(apres.body.nonLues).toBe(nonLuesAvant - 1);
    expect(apres.body.elements[0].lueLe).not.toBeNull();
  });

  it('donne le journal et les statistiques au secrétariat, pas aux parents', async () => {
    const echecs = await http()
      .get('/api/notifications/journal?canal=SMS&statut=ECHOUEE')
      .set(avec('secretariat'))
      .expect(200);
    expect(
      echecs.body.elements.map((n: { destinataire: string }) => n.destinataire),
    ).toContain(t.Penda.contact1);
    await http()
      .get('/api/notifications/journal')
      .set(avec('parent'))
      .expect(403);

    const stats = await http()
      .get('/api/notifications/statistiques')
      .set(avec('secretariat'))
      .expect(200);
    expect(stats.body.parCanal.SMS.ECHOUEE).toBeGreaterThanOrEqual(2);
    expect(stats.body.sms.envoyes).toBeGreaterThanOrEqual(4);
    expect(stats.body.parCanal).not.toHaveProperty('APPLICATION');
  });

  it('renvoie une notification en échec', async () => {
    const [echec] = await lignes({
      tuteurId: t.Penda.id,
      canal: 'SMS',
      statut: 'ECHOUEE',
    });
    const [envoyee] = await lignes({ tuteurId: t.Astou.id, canal: 'SMS' });
    await http()
      .post(`/api/notifications/${envoyee.id}/renvoyer`)
      .set(avec('secretariat'))
      .expect(403);
    await http()
      .post(`/api/notifications/${echec.id}/renvoyer`)
      .set(avec('secretariat'))
      .expect(201);
    const relancee = await attendre(
      () => prisma.notification.findUniqueOrThrow({ where: { id: echec.id } }),
      (n) => n.statut === 'ECHOUEE' && n.essais > 3,
    );
    expect(relancee.essais).toBe(6);
  });

  it('utilise les modèles personnalisés et refuse une variable inconnue', async () => {
    await http()
      .put('/api/notifications/modeles/RAPPEL_PAIEMENT/SMS')
      .set(avec('secretariat'))
      .send({ contenu: 'Payez {montant} avant {inconnue}.' })
      .expect(400);
    await http()
      .put('/api/notifications/modeles/RAPPEL_PAIEMENT/SMS')
      .set(avec('secretariat'))
      .send({
        contenu:
          'École : {montant} FCFA pour {prenom_eleve}, avant le {date_limite}.',
      })
      .expect(200);

    const source = randomUUID();
    await service.notifier({
      ecoleId,
      type: 'RAPPEL_PAIEMENT',
      cible: { eleveIds: [awa] },
      variables: { montant: '25 000', mois: 'octobre', date_limite: '05/11' },
      sourceId: source,
      cleDeduplication: `rappel-${source}`,
    });
    const [sms] = await lignes({
      sourceId: source,
      tuteurId: t.Astou.id,
      canal: 'SMS',
    });
    expect(sms.contenu).toBe('École : 25 000 FCFA pour Awa, avant le 05/11.');

    // Même clé : personne n'est prévenu deux fois.
    const doublon = await service.notifier({
      ecoleId,
      type: 'RAPPEL_PAIEMENT',
      cible: { eleveIds: [awa] },
      variables: { montant: '25 000' },
      cleDeduplication: `rappel-${source}`,
    });
    expect(doublon).toEqual({ tuteurs: 0, envois: 0 });

    const reinit = await http()
      .delete('/api/notifications/modeles/RAPPEL_PAIEMENT/SMS')
      .set(avec('secretariat'))
      .expect(200);
    const modele = reinit.body
      .find((m: { type: string }) => m.type === 'RAPPEL_PAIEMENT')
      .canaux.find((c: { canal: string }) => c.canal === 'SMS');
    expect(modele.personnalise).toBe(false);
    expect(modele.apercu.length).toBeLessThanOrEqual(160);
  });
});
