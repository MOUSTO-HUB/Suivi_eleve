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
pnpm dev:api      # http://localhost:3100/api/sante
pnpm dev:web      # http://localhost:3001
pnpm dev:mobile   # scanner le QR code avec l'application Expo Go
```

Arrêter la base : `pnpm db:down`.

## Commandes utiles

| Commande                                  | Rôle                                  |
| ----------------------------------------- | ------------------------------------- |
| `pnpm lint`                               | Lint de toutes les applications       |
| `pnpm typecheck`                          | Vérification des types                |
| `pnpm test`                               | Tests unitaires (API et mobile)       |
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

## Application mobile

L'application (`mobile/`, Expo Router) a deux espaces, choisis selon le compte :

- **Parents** (connexion par numéro + code SMS) : accueil avec les derniers messages et le choix de l'enfant, messages (accusé de lecture à l'ouverture, 50 derniers gardés hors ligne), événements (calendrier, réponse oui/non, pièce jointe), résultats publiés et bulletins PDF, comportement, absences (motif transmis à l'école), paiements en attente, appareils (déclarer une perte), préférences des messages.
- **Personnel** (email + mot de passe) : scanner l'étiquette QR d'un appareil (ou saisir son code), voir l'élève et appeler ses tuteurs, signaler un usage en classe, une confiscation…, signaler un comportement.

Sur un téléphone, l'API doit être joignable par son adresse sur le réseau local (Expo ne lit pas le `.env` de la racine) :

```bash
# mobile/.env.local (non versionné)
EXPO_PUBLIC_API_URL=http://192.168.1.20:3100/api
```

Trois façons de l'essayer :

| Où                          | Comment                                                                                                                                 | Limites                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Navigateur (le plus rapide) | `pnpm dev:mobile` puis touche `w`, ou ouvrir l'adresse du serveur Expo ; dans Chrome, F12 puis l'icône téléphone pour la taille d'écran | pas de push ni de caméra fiable (saisir le code de l'étiquette) ; jetons dans `localStorage` (développement seulement) |
| Téléphone Android           | application **Expo Go** (Play Store), même réseau Wi-Fi que le PC, scanner le QR code affiché par Expo                                  | pas de push (build de développement nécessaire)                                                                        |
| iPhone                      | Expo Go n'est plus sur l'App Store : il faut un compte Apple Developer (99 $/an), `npx eas-cli go` puis TestFlight                      | idem                                                                                                                   |

L'origine de la version navigateur doit figurer dans `WEB_ORIGIN` (CORS de l'API), ex. `http://localhost:8090` si Expo est lancé avec `--port 8090`.

Les notifications push exigent un build de développement (`npx expo run:android` ou `eas build --profile development`) avec Firebase configuré : le jeton FCM de l'appareil est alors enregistré automatiquement auprès de l'API après la connexion.

## État du projet

Lot 1 terminé : socle (prompt 1), base de données (prompt 2), authentification (prompt 3), élèves, tuteurs et classes avec import/export et back-office web (prompt 4). Lot 2 terminé : appareils des élèves (prompt 5), moteur de notifications SMS, email et push (prompt 6), absence de cours, libération anticipée et absences injustifiées des élèves (prompt 7). Lot 3 terminé : résultats saisis par les professeurs, bulletins PDF et décisions de fin d'année (prompt 8), comportements marquants avec validation des cas graves et convocations (prompt 9), rappels de paiement avec retard calculé (prompt 10, la comptabilité restant dans les outils de l'école), événements de l'école avec calendrier, pièce jointe, rappel la veille à 18h et réponses oui/non des parents (prompt 11). Lot 4 en cours : application mobile parents et personnel (prompt 12). Prochaine étape : espace parents web, sécurité et mise en production (prompt 13).

## Notifications

Le moteur envoie les messages par file d'attente (Redis + BullMQ) : 3 essais avec délai croissant, bascule sur le fournisseur SMS de secours puis sur Contact_tuteur_2, journal de chaque envoi. En développement, `SMS_FOURNISSEUR=console` (et `EMAIL_FOURNISSEUR`, `PUSH_FOURNISSEUR`) écrit les messages dans les logs de l'API au lieu de les envoyer.

Pour envoyer de vrais messages, renseigner dans `.env` :

| Canal         | Fournisseur              | Variables                                                                                               |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| SMS           | Orange SMS API           | `SMS_FOURNISSEUR=orange`, `ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET`, `ORANGE_NUMERO_EXPEDITEUR`        |
| SMS (secours) | Twilio                   | `SMS_FOURNISSEUR_SECOURS=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMERO_EXPEDITEUR` |
| Email         | Brevo                    | `EMAIL_FOURNISSEUR=brevo`, `BREVO_API_KEY`, `EMAIL_EXPEDITEUR`                                          |
| Push          | Firebase Cloud Messaging | `PUSH_FOURNISSEUR=fcm`, `FCM_PROJET_ID`, `FCM_EMAIL_COMPTE_SERVICE`, `FCM_CLE_PRIVEE`                   |

Accusés de livraison : renseigner `API_URL_PUBLIQUE` et `WEBHOOK_SECRET`. Les adresses de rappel sont alors envoyées automatiquement à Orange et à Twilio ; chez Brevo, déclarer le webhook `<API_URL_PUBLIQUE>/notifications/webhooks/brevo?jeton=<WEBHOOK_SECRET>`.
