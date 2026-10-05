# Projet Suivi_eleve

Application de suivi des élèves pour les parents : web (administration + parents) et mobile (parents, enseignants, surveillants).

Spécifications : `docs/CAHIER_DES_CHARGES.md` · Étapes de développement : `docs/PROMPTS.md`.

## Stack

- Backend : NestJS + Prisma + PostgreSQL (dossier `/api`)
- Web : Next.js + Tailwind (dossier `/web`)
- Mobile : React Native Expo (dossier `/mobile`)
- Files d'envoi : Redis + BullMQ
- Monorepo pnpm

## Outillage

- API : NestJS 12 en modules ES (imports locaux suffixés `.js`), lint oxlint, tests Vitest (`*.spec.ts`, e2e dans `api/test`). Routes sous le préfixe `/api`.
- Base : Prisma 7 (`api/prisma/schema.prisma`, config `api/prisma7.config.ts`). Client généré dans `api/src/generated/prisma` (non versionné, `pnpm db:generate`), importé depuis `../generated/prisma/client.js` ; connexion via `PrismaService` (adaptateur `@prisma/adapter-pg`). Modifier le schéma puis `pnpm db:migrate` ; ne jamais éditer une migration déjà poussée.
- Authentification (`api/src/auth`) : toutes les routes exigent un jeton, sauf celles marquées `@Public()`. Restreindre par rôle avec `@Roles(Role.X)`. Toute route qui prend un id d'élève porte `@UseGuards(ParentOwnsEleveGuard)` (+ `@ParamEleve('id')` si le paramètre ne s'appelle pas `eleveId`). Utilisateur courant : `@UtilisateurCourant()`. Le personnel doit toujours être filtré par `utilisateur.ecoleId`.
- Notifications : passer par `NotificationsService.notifier({ ecoleId, type, cible: { eleveIds | classeIds | ecole }, variables })` ; canaux, priorité et caractère obligatoire viennent de `REGLES_TYPE`, les textes des modèles (`modeles.defaut.ts`, modifiables par l'école). Un message par tuteur (frères et sœurs regroupés), une ligne par canal + une ligne `APPLICATION` (historique du parent). Ne jamais appeler un fournisseur SMS/email/push directement depuis un module métier. Envoi par BullMQ (Redis) dans `EnvoiService`.
- Fichiers : `StockageService` (dossier `STOCKAGE_DIR`) ; ne jamais exposer la clé de stockage dans l'API.
- Web : Next.js 16 (App Router), lint ESLint, port 3001. Lire `web/node_modules/next/dist/docs/` avant d'écrire du code (API différentes des versions précédentes : `proxy.ts` au lieu de middleware, `params`/`searchParams` asynchrones, `refresh()` dans les Server Actions). Données lues côté serveur via `lib/api.ts` (`lireApi`, `envoyerApi`) avec le jeton en cookie httpOnly ; formulaires via `FormulaireAction` + Server Actions ; `proxy.ts` renouvelle le jeton d'accès.
- Mobile : Expo SDK 57 ; ajouter une dépendance avec `npx expo install`, jamais `pnpm add`.
- Prettier commun à la racine (guillemets simples).
- Vérifier avant de terminer une tâche : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.

## Rôles

ADMIN, SECRETARIAT, ENSEIGNANT, SURVEILLANT, COMPTABLE, PARENT.

## Règles

- Interface et messages en français.
- Un parent ne voit que ses enfants (vérifié côté serveur).
- Jamais de suppression définitive d'un élève (archivage).
- Numéros de téléphone au format E.164.
- Montants en FCFA entiers.

## Toujours

- Tests unitaires sur la logique métier.
- Validation des entrées (class-validator).
- Documentation OpenAPI à jour.
