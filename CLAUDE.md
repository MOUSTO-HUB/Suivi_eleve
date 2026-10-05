# Projet Suivi_eleve

Application de suivi des élèves pour les parents : web (administration + parents) et mobile (parents, enseignants, surveillants).

Spécifications : `docs/CAHIER_DES_CHARGES.md` · Étapes de développement : `docs/PROMPTS.md`.

## Stack

- Backend : NestJS + Prisma + PostgreSQL (dossier `/api`)
- Web : Next.js + Tailwind (dossier `/web`)
- Mobile : React Native Expo (dossier `/mobile`)
- Files d'envoi : Redis + BullMQ
- Monorepo pnpm

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
