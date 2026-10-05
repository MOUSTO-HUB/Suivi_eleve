# Suivi_eleve

Application web et mobile de suivi des élèves qui informe les parents en temps réel (SMS, email, notification push) :

- absence de cours et libération anticipée des élèves, avec motif ;
- résultats et décisions d'admission ;
- comportements marquants ;
- paiements mensuels et retards de paiement ;
- événements importants de l'école.

Elle gère aussi le dossier de chaque élève et l'enregistrement de ses appareils (téléphones, tablettes, ordinateurs) pour les retrouver facilement et encadrer leur usage en classe.

## Documentation

- [Cahier des charges](docs/CAHIER_DES_CHARGES.md)
- [Prompts de développement](docs/PROMPTS.md)

## Structure

| Dossier   | Contenu                          | Technologie                    |
| --------- | -------------------------------- | ------------------------------ |
| `api/`    | API REST                         | NestJS + Prisma 7 + PostgreSQL |
| `web/`    | Back-office et espace parents    | Next.js + Tailwind             |
| `mobile/` | Application parents et personnel | React Native (Expo)            |
| `docs/`   | Cahier des charges et prompts    | Markdown                       |

## Lancer le projet en local

Prérequis : [Node.js 22 ou plus](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/) et pnpm (`corepack enable`).

```bash
# 1. Variables d'environnement
cp .env.example .env

# 2. Dépendances
pnpm install

# 3. PostgreSQL et Redis, puis tables et données de test
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 4. Applications (un terminal chacune)
pnpm dev:api      # http://localhost:3000/api/sante
pnpm dev:web      # http://localhost:3001
pnpm dev:mobile   # scanner le QR code avec l'application Expo Go
```

Arrêter la base : `pnpm db:down`.

## Commandes utiles

| Commande          | Rôle                                |
| ----------------- | ----------------------------------- |
| `pnpm lint`       | Lint de toutes les applications     |
| `pnpm typecheck`  | Vérification des types              |
| `pnpm test`       | Tests unitaires de l'API            |
| `pnpm build`      | Build de l'API et du web            |
| `pnpm format`     | Formatage Prettier                  |
| `pnpm db:migrate` | Crée et applique les migrations     |
| `pnpm db:seed`    | Données de test (relançable)        |
| `pnpm db:studio`  | Explorer la base dans le navigateur |

Le schéma de données est dans [`api/prisma/schema.prisma`](api/prisma/schema.prisma). Les données de test créent une école, l'année 2026-2027 (3 trimestres), 6 comptes du personnel, 2 classes, 20 élèves, 25 tuteurs et 10 appareils.

## État du projet

Lot 1 en cours : socle du monorepo (prompt 1) et schéma de base de données (prompt 2) en place. Prochaine étape : authentification et rôles (prompt 3).
