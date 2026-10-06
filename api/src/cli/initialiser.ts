// Compte du concepteur (SUPER_ADMIN), qui crée ensuite les écoles depuis le site
// (espace /plateforme). À lancer à la première mise en service :
//   node dist/cli/initialiser.js --prenoms Awa --nom Diop --email moi@exemple.com
// Relancé avec l'email d'un concepteur existant : nouveau mot de passe provisoire
// (mot de passe oublié). Les sessions ouvertes de ce compte sont fermées.
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseArgs } from 'node:util';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import { motDePasseProvisoire } from '../utilisateurs/utilisateurs.regles.js';

const { values } = parseArgs({
  options: {
    prenoms: { type: 'string' },
    nom: { type: 'string' },
    email: { type: 'string' },
  },
});

function arreter(message: string): never {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
if (!email)
  arreter('indiquez --email (et --prenoms, --nom pour un nouveau compte).');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) arreter('email invalide.');
if (!process.env.DATABASE_URL) arreter('DATABASE_URL est absent.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const motDePasse = motDePasseProvisoire();
  const existant = await prisma.utilisateur.findUnique({ where: { email } });

  if (existant) {
    if (existant.role !== Role.SUPER_ADMIN)
      arreter('cet email appartient au compte d’une école, pas au concepteur.');
    await prisma.utilisateur.update({
      where: { id: existant.id },
      data: { motDePasseHash: await hash(motDePasse), actif: true },
    });
    await prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId: existant.id, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    console.log(
      `Nouveau mot de passe provisoire pour ${email} : ${motDePasse}`,
    );
  } else {
    const { prenoms, nom } = values;
    if (!prenoms || !nom)
      arreter('indiquez --prenoms et --nom pour créer le compte concepteur.');
    await prisma.utilisateur.create({
      data: {
        ecoleId: null,
        prenoms,
        nom,
        email,
        role: Role.SUPER_ADMIN,
        motDePasseHash: await hash(motDePasse),
      },
    });
    console.log(`Compte concepteur créé : ${email}`);
    console.log(`Mot de passe provisoire : ${motDePasse}`);
  }
  console.log(
    'Connectez-vous sur le site (onglet « Personnel de l’école ») : espace concepteur, menu « Mon compte » pour changer le mot de passe.',
  );
} finally {
  await prisma.$disconnect();
}
