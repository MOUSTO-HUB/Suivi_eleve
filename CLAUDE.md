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
- Notifications : push mobile (FCM) et Web Push du site installé (`JetonPush` plateforme WEB : endpoint + clés, VAPID_*, services push autorisés dans `estServicePushWeb`) ; passer par `NotificationsService.notifier({ ecoleId, type, cible: { eleveIds | classeIds | ecole }, variables })` ; canaux, priorité et caractère obligatoire viennent de `REGLES_TYPE`, les textes des modèles (`modeles.defaut.ts`, modifiables par l'école). Un message par tuteur (frères et sœurs regroupés), une ligne par canal + une ligne `APPLICATION` (historique du parent). Ne jamais appeler un fournisseur SMS/email/push directement depuis un module métier. Envoi par BullMQ (Redis) dans `EnvoiService`.
- Fichiers : `StockageService` (dossier `STOCKAGE_DIR`) ; ne jamais exposer la clé de stockage dans l'API.
- Web : Next.js 16 (App Router), lint ESLint, port 3001. Lire `web/node_modules/next/dist/docs/` avant d'écrire du code (API différentes des versions précédentes : `proxy.ts` au lieu de middleware, `params`/`searchParams` asynchrones, `refresh()` dans les Server Actions). Données lues côté serveur via `lib/api.ts` (`lireApi`, `envoyerApi`) avec le jeton en cookie httpOnly ; formulaires via `FormulaireAction` + Server Actions ; `proxy.ts` renouvelle le jeton d'accès. Site installable (PWA) : `app/manifest.ts`, icônes `public/icones` + `app/icon.svg`/`app/apple-icon.png`, `public/sw.js` (page hors ligne et notifications Web Push, jamais de données en cache), activation des notifications `components/notifications-push.tsx`, bandeau `components/installation.tsx` ; tout nouveau fichier public hors `.png/.svg/.ico` doit être exclu du `matcher` de `proxy.ts`.
- Mobile : Expo SDK 57 ; ajouter une dépendance avec `npx expo install`, jamais `pnpm add`. Couleurs par `useTheme()` / `useStyles(creerStyles)` (`src/lib/theme.tsx`, clair/sombre au choix ☀️/🌙), jamais de couleur en dur ; dégradés avec `degrade()`.
- Design web « bleu école » : couleurs `marque-*`, `soleil-*`, fond des cartes `bg-carte` (jamais `bg-white`), dégradés `fond-bandeau`/`fond-degrade`/`contour-degrade` ; le mode sombre (bouton ☀️/🌙, cookie `theme`, `data-theme` sur `<html>`) inverse les nuances dans `globals.css`, sans classes `dark:`.
- Prettier commun à la racine (guillemets simples).
- Sécurité : `api/test/securite.e2e-spec.ts` inventorie toutes les routes. Une nouvelle route doit porter `@Roles(...)` (ou `@Public()`), sinon être ajoutée, avec sa justification, à `OUVERTES_A_TOUS_CONNECTES`. Les routes d'authentification passent par `LimiteurService` (Redis). L'API croit `X-Forwarded-For` seulement d'un relais privé ; le site le transmet (`transmettreIp`). Actions sensibles : `AuditService.journaliser` (l'IP est ajoutée automatiquement). Formulaires publics (connexion, demande de code SMS, mot de passe oublié) : champ `altcha` vérifié par `AltchaService`. Personnel : blocage progressif (`VerrouillageService`, `connexion.regles.ts`) et double authentification (`DoubleAuthService`, obligatoire pour ADMIN, COMPTABLE, SUPER_ADMIN) ; `/auth/connexion` peut renvoyer `{ doubleAuth }` au lieu d'une session. Codes et liens de sécurité envoyés par `EmailSender` (comme `SmsSender`).
- Comptes : le personnel est créé par la direction (`/utilisateurs`, mot de passe provisoire affiché une fois). Le concepteur (SUPER_ADMIN, `ecoleId` nul, compte créé par `node dist/cli/initialiser.js`) crée les écoles et leur direction dans l'espace web `/plateforme` (module `api/src/plateforme`) et enregistre les paiements d'abonnement (150 000 GNF/mois ou 1 500 000 GNF/an, règles dans `abonnements.regles.ts`). Il n'entre que sur les routes `@Roles(Role.SUPER_ADMIN)` ou `@OuvertAuConcepteur()` (RolesGuard), jamais sur les données des écoles. École suspendue (`EtatEcolesService`) : ni session, ni code SMS, ni notification. Les parents n'ont pas de compte à créer (code SMS) et acceptent le texte de consentement (`VERSION_CONSENTEMENT`) à la première connexion.
- Production : `docker-compose.prod.yml` (Caddy, API, site, PostgreSQL, Redis, sauvegarde chiffrée), guide `docs/DEPLOIEMENT.md`, CI `.github/workflows/ci.yml`, mobile `mobile/eas.json`.
- Vérifier avant de terminer une tâche : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.

## Rôles

ADMIN, SECRETARIAT, ENSEIGNANT, SURVEILLANT, COMPTABLE, PARENT dans chaque école ; SUPER_ADMIN (concepteur, sans école) administre les écoles abonnées.

## Règles

- Interface et messages en français.
- Un parent ne voit que ses enfants (vérifié côté serveur).
- Jamais de suppression définitive d'un élève (archivage).
- Numéros de téléphone au format E.164 ; numéro saisi sans indicatif : celui du pays de l'école (ou choisi par le parent à la connexion).
- Montants entiers dans la monnaie du pays de l'école : GNF (Guinée) ou FCFA (Côte d'Ivoire, Sénégal) ; table `api/src/common/pays.ts` (copiée dans `web/lib/pays.ts` et `mobile/src/lib/format.ts`), variable `{monnaie}` des modèles. Abonnements au service : toujours en GNF.

## Toujours

- Tests unitaires sur la logique métier.
- Validation des entrées (class-validator).
- Documentation OpenAPI à jour.
