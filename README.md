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

| Commande                                  | Rôle                                  |
| ----------------------------------------- | ------------------------------------- |
| `pnpm lint`                               | Lint de toutes les applications       |
| `pnpm typecheck`                          | Vérification des types                |
| `pnpm test`                               | Tests unitaires de l'API              |
| `pnpm --filter @suivi-eleve/api test:e2e` | Tests de bout en bout (base démarrée) |
| `pnpm build`                              | Build de l'API et du web              |
| `pnpm format`                             | Formatage Prettier                    |
| `pnpm db:migrate`                         | Crée et applique les migrations       |
| `pnpm db:seed`                            | Données de test (relançable)          |
| `pnpm db:studio`                          | Explorer la base dans le navigateur   |

Le schéma de données est dans [`api/prisma/schema.prisma`](api/prisma/schema.prisma). Les données de test créent une école, l'année 2026-2027 (3 trimestres), 6 comptes du personnel, 2 classes, 20 élèves, 25 tuteurs et 10 appareils.

## Se connecter en développement

| Qui       | Route                                                               | Identifiants de test                                                                                                                                                         |
| --------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personnel | `POST /api/auth/connexion`                                          | `direction@ecole-pilote.sn`, `secretariat@…`, `comptabilite@…`, `surveillant@…`, `prof.diop@…`, `prof.ba@…` ; mot de passe `SEED_MOT_DE_PASSE` (`Suivi-Dev-2026` par défaut) |
| Parent    | `POST /api/auth/otp/demande` puis `POST /api/auth/otp/verification` | un numéro de tuteur, ex. `+221771000036` ; avec `SMS_FOURNISSEUR=console`, le code s'affiche dans les logs de l'API                                                          |

Les deux renvoient un jeton d'accès (15 minutes, à passer dans `Authorization: Bearer …`) et un jeton de rafraîchissement (30 jours, `POST /api/auth/rafraichir`). `GET /api/auth/moi` renvoie l'utilisateur connecté.

## État du projet

Lot 1 terminé : socle (prompt 1), base de données (prompt 2), authentification (prompt 3), élèves, tuteurs et classes avec import/export et back-office web (prompt 4). Lot 2 en cours : appareils des élèves avec étiquettes QR et signalements (prompt 5). Prochaine étape : moteur de notifications SMS, email et push (prompt 6).

Les notifications aux parents (appareil trouvé, confisqué, usage en classe…) sont déjà enregistrées en file d'attente (table `notifications`, statut `EN_FILE`) ; leur envoi réel arrive avec le prompt 6.
