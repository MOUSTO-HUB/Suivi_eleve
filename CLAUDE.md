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
- Web : Next.js 16 (App Router), lint ESLint, port 3001.
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
