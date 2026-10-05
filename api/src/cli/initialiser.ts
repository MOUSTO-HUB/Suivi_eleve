// Première mise en service : l'école, l'année scolaire (3 trimestres) et le
// premier compte de la direction. À lancer une seule fois sur une base vide :
//   node dist/cli/initialiser.js --ecole "Collège X" --prenoms Awa --nom Diop \
//     --email direction@college-x.sn [--annee 2026]
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseArgs } from 'node:util';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import { motDePasseProvisoire } from '../utilisateurs/utilisateurs.regles.js';

const { values } = parseArgs({
  options: {
    ecole: { type: 'string' },
    prenoms: { type: 'string' },
    nom: { type: 'string' },
    email: { type: 'string' },
    annee: { type: 'string' },
  },
});

function arreter(message: string): never {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const { ecole: nomEcole, prenoms, nom } = values;
const email = values.email?.trim().toLowerCase();
if (!nomEcole || !prenoms || !nom || !email)
  arreter('indiquez --ecole, --prenoms, --nom et --email.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) arreter('email invalide.');
const debut = Number(values.annee ?? new Date().getUTCFullYear());
if (!Number.isInteger(debut) || debut < 2020 || debut > 2100)
  arreter('--annee doit être une année de rentrée, ex. 2026.');
if (!process.env.DATABASE_URL) arreter('DATABASE_URL est absent.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  if ((await prisma.ecole.count()) > 0)
    arreter(
      "une école existe déjà : l'initialisation ne sert qu'une fois (gérez ensuite les comptes depuis le site, menu Personnel).",
    );

  const motDePasse = motDePasseProvisoire();
  const ecole = await prisma.ecole.create({ data: { nom: nomEcole } });
  const annee = await prisma.anneeScolaire.create({
    data: {
      ecoleId: ecole.id,
      libelle: `${debut}-${debut + 1}`,
      dateDebut: new Date(Date.UTC(debut, 9, 1)),
      dateFin: new Date(Date.UTC(debut + 1, 6, 15)),
      active: true,
    },
  });
  const trimestres: [string, Date, Date][] = [
    [
      'Trimestre 1',
      new Date(Date.UTC(debut, 9, 1)),
      new Date(Date.UTC(debut, 11, 20)),
    ],
    [
      'Trimestre 2',
      new Date(Date.UTC(debut + 1, 0, 4)),
      new Date(Date.UTC(debut + 1, 2, 31)),
    ],
    [
      'Trimestre 3',
      new Date(Date.UTC(debut + 1, 3, 12)),
      new Date(Date.UTC(debut + 1, 6, 15)),
    ],
  ];
  for (const [i, [libelle, dateDebut, dateFin]] of trimestres.entries()) {
    await prisma.periode.create({
      data: {
        anneeScolaireId: annee.id,
        ordre: i + 1,
        libelle,
        dateDebut,
        dateFin,
      },
    });
  }
  await prisma.utilisateur.create({
    data: {
      ecoleId: ecole.id,
      prenoms,
      nom,
      email,
      role: Role.ADMIN,
      motDePasseHash: await hash(motDePasse),
    },
  });

  console.log(
    `École « ${nomEcole} » créée, année ${annee.libelle} (3 trimestres).`,
  );
  console.log(`Compte de la direction : ${email}`);
  console.log(`Mot de passe provisoire : ${motDePasse}`);
  console.log('À changer dès la première connexion (menu « Mon compte »).');
} finally {
  await prisma.$disconnect();
}
