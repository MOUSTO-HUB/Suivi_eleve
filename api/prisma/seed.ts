// Données fictives de développement : 1 école, 2 classes, 20 élèves, 25 tuteurs, 10 appareils.
// Le script est idempotent (upsert sur des clés uniques) : il peut être relancé sans doublons.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Genre,
  LienTuteur,
  PrismaClient,
  Role,
  TypeAppareil,
} from '../src/generated/prisma/client.js';

config({ path: ['.env', '../.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Le seed de développement ne doit pas tourner en production.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ECOLE_ID = '00000000-0000-7000-8000-000000000001';

const PRENOMS_GARCONS = [
  'Moustapha',
  'Mamadou',
  'Ibrahima',
  'Cheikh',
  'Ousmane',
  'Abdoulaye',
  'Modou',
  'Serigne',
  'Pape',
  'Lamine',
];
const PRENOMS_FILLES = [
  'Fatou',
  'Aminata',
  'Awa',
  'Mariama',
  'Khady',
  'Ramatoulaye',
  'Ndeye',
  'Aissatou',
  'Coumba',
  'Bineta',
];
const NOMS = [
  'Diop',
  'Ndiaye',
  'Fall',
  'Sow',
  'Gueye',
  'Ba',
  'Sarr',
  'Faye',
  'Diallo',
  'Mbaye',
  'Cisse',
  'Thiam',
  'Kane',
  'Seck',
  'Diouf',
  'Niang',
  'Sy',
  'Camara',
  'Toure',
  'Wade',
];
const PRENOMS_TUTEURS = [
  'Alioune',
  'Babacar',
  'Malick',
  'Souleymane',
  'Assane',
  'Daouda',
  'Omar',
  'Idrissa',
  'Mansour',
  'Youssou',
  'Sokhna',
  'Adama',
  'Seynabou',
  'Yacine',
  'Penda',
  'Astou',
  'Maimouna',
  'Dieynaba',
  'Rokhaya',
  'Marieme',
  'Ndeye Fatou',
  'Ousseynou',
  'Elhadji',
  'Arame',
  'Nogaye',
];

const telephone = (i: number) =>
  `+22177${String(1000000 + i).padStart(7, '0')}`;

async function main() {
  const ecole = await prisma.ecole.upsert({
    where: { id: ECOLE_ID },
    update: {},
    create: {
      id: ECOLE_ID,
      nom: 'École pilote Suivi_eleve',
      adresse: 'Dakar',
      telephone: '+221338000000',
      email: 'contact@ecole-pilote.sn',
    },
  });

  const annee = await prisma.anneeScolaire.upsert({
    where: { ecoleId_libelle: { ecoleId: ecole.id, libelle: '2026-2027' } },
    update: { active: true },
    create: {
      ecoleId: ecole.id,
      libelle: '2026-2027',
      dateDebut: new Date('2026-10-01'),
      dateFin: new Date('2027-07-15'),
      active: true,
    },
  });

  const trimestres = [
    {
      ordre: 1,
      libelle: 'Trimestre 1',
      dateDebut: '2026-10-01',
      dateFin: '2026-12-20',
    },
    {
      ordre: 2,
      libelle: 'Trimestre 2',
      dateDebut: '2027-01-04',
      dateFin: '2027-03-31',
    },
    {
      ordre: 3,
      libelle: 'Trimestre 3',
      dateDebut: '2027-04-12',
      dateFin: '2027-07-15',
    },
  ];
  for (const t of trimestres) {
    await prisma.periode.upsert({
      where: {
        anneeScolaireId_ordre: { anneeScolaireId: annee.id, ordre: t.ordre },
      },
      update: {},
      create: {
        anneeScolaireId: annee.id,
        ordre: t.ordre,
        libelle: t.libelle,
        dateDebut: new Date(t.dateDebut),
        dateFin: new Date(t.dateFin),
      },
    });
  }

  // Personnel (sans mot de passe : l'authentification arrive au prompt 3).
  const personnel = [
    {
      email: 'direction@ecole-pilote.sn',
      prenoms: 'Awa',
      nom: 'Ndiaye',
      role: Role.ADMIN,
    },
    {
      email: 'secretariat@ecole-pilote.sn',
      prenoms: 'Coumba',
      nom: 'Sarr',
      role: Role.SECRETARIAT,
    },
    {
      email: 'comptabilite@ecole-pilote.sn',
      prenoms: 'Ibrahima',
      nom: 'Fall',
      role: Role.COMPTABLE,
    },
    {
      email: 'surveillant@ecole-pilote.sn',
      prenoms: 'Lamine',
      nom: 'Gueye',
      role: Role.SURVEILLANT,
    },
    {
      email: 'prof.diop@ecole-pilote.sn',
      prenoms: 'Mamadou',
      nom: 'Diop',
      role: Role.ENSEIGNANT,
    },
    {
      email: 'prof.ba@ecole-pilote.sn',
      prenoms: 'Mariama',
      nom: 'Ba',
      role: Role.ENSEIGNANT,
    },
  ];
  const utilisateurs = new Map<string, string>();
  for (const p of personnel) {
    const u = await prisma.utilisateur.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, ecoleId: ecole.id },
    });
    utilisateurs.set(p.email, u.id);
  }

  const classes = [];
  for (const [nom, enseignant] of [
    ['6e A', 'prof.diop@ecole-pilote.sn'],
    ['6e B', 'prof.ba@ecole-pilote.sn'],
  ] as const) {
    classes.push(
      await prisma.classe.upsert({
        where: { anneeScolaireId_nom: { anneeScolaireId: annee.id, nom } },
        update: {},
        create: {
          ecoleId: ecole.id,
          anneeScolaireId: annee.id,
          nom,
          niveau: '6e',
          enseignantPrincipalId: utilisateurs.get(enseignant),
        },
      }),
    );
  }

  // 25 tuteurs.
  const tuteurs = [];
  for (let i = 0; i < 25; i++) {
    const contact1 = telephone(i * 2);
    tuteurs.push(
      await prisma.tuteur.upsert({
        where: { ecoleId_contact1: { ecoleId: ecole.id, contact1 } },
        update: {},
        create: {
          ecoleId: ecole.id,
          prenoms: PRENOMS_TUTEURS[i],
          nom: NOMS[i % NOMS.length],
          contact1,
          contact2: i % 3 === 0 ? telephone(i * 2 + 1) : null,
          email: i % 2 === 0 ? `tuteur${i + 1}@exemple.sn` : null,
          consentementLe: new Date('2026-09-15'),
        },
      }),
    );
  }

  // 20 élèves, 10 par classe. L'élève i a le tuteur i comme tuteur principal ;
  // les tuteurs 20 à 24 sont second tuteur des élèves 0 à 4 ;
  // les élèves 18 et 19 sont frère et sœur (tuteur 18 en commun).
  for (let i = 0; i < 20; i++) {
    const fille = i % 2 === 1;
    const prenoms = fille
      ? PRENOMS_FILLES[Math.floor(i / 2)]
      : PRENOMS_GARCONS[Math.floor(i / 2)];
    const nom = i === 19 ? NOMS[18] : NOMS[i];
    const matricule = `SE-2026-${String(i + 1).padStart(4, '0')}`;
    const classe = classes[i < 10 ? 0 : 1];

    const eleve = await prisma.eleve.upsert({
      where: { matricule },
      update: {},
      create: {
        ecoleId: ecole.id,
        matricule,
        prenoms,
        nom,
        genre: fille ? Genre.FEMININ : Genre.MASCULIN,
        dateNaissance: new Date(
          `2014-${String((i % 12) + 1).padStart(2, '0')}-15`,
        ),
        telephone: i % 4 === 0 ? telephone(100 + i) : null,
        classeId: classe.id,
        dateInscription: new Date('2026-09-20'),
      },
    });

    const liens: { tuteurIndex: number; principal: boolean }[] = [
      { tuteurIndex: i === 19 ? 18 : i, principal: true },
    ];
    if (i < 5) liens.push({ tuteurIndex: 20 + i, principal: false });

    for (const { tuteurIndex, principal } of liens) {
      const tuteurId = tuteurs[tuteurIndex].id;
      await prisma.eleveTuteur.upsert({
        where: { eleveId_tuteurId: { eleveId: eleve.id, tuteurId } },
        update: {},
        create: {
          eleveId: eleve.id,
          tuteurId,
          principal,
          lien: principal ? LienTuteur.PERE : LienTuteur.MERE,
        },
      });
    }

    const historique = await prisma.historiqueClasse.findFirst({
      where: { eleveId: eleve.id, classeId: classe.id },
    });
    if (!historique) {
      await prisma.historiqueClasse.create({
        data: {
          eleveId: eleve.id,
          classeId: classe.id,
          dateDebut: new Date('2026-10-01'),
        },
      });
    }

    // Les 10 premiers élèves ont un appareil.
    if (i < 10) {
      const telephonePortable = i % 3 !== 2;
      const imei = telephonePortable
        ? `35${String(1234567890000 + i).padStart(13, '0')}`
        : null;
      const numeroSerie = `SN-${String(i + 1).padStart(5, '0')}`;
      const existant = await prisma.appareil.findFirst({
        where: { numeroSerie },
      });
      if (!existant) {
        await prisma.appareil.create({
          data: {
            ecoleId: ecole.id,
            eleveId: eleve.id,
            type: telephonePortable
              ? TypeAppareil.TELEPHONE
              : TypeAppareil.TABLETTE,
            marque: telephonePortable
              ? ['Samsung', 'Tecno', 'Infinix'][i % 3]
              : 'Lenovo',
            modele: telephonePortable ? 'Galaxy A15' : 'Tab M10',
            couleur: ['noir', 'bleu', 'blanc'][i % 3],
            numeroSerie,
            imei,
            signesDistinctifs: i % 2 === 0 ? 'Coque transparente' : null,
          },
        });
      }
    }
  }

  const compte = {
    classes: await prisma.classe.count(),
    eleves: await prisma.eleve.count(),
    tuteurs: await prisma.tuteur.count(),
    appareils: await prisma.appareil.count(),
  };
  console.log('Seed terminé :', compte);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
