# Prompts pour construire Suivi_eleve avec un assistant IA

Donnez ces prompts dans l'ordre à un assistant de code (Claude Code par exemple), un par session de travail ; validez et testez chaque étape avant de passer à la suivante.

Le prompt 0 (contexte du projet) est déjà en place dans [`CLAUDE.md`](../CLAUDE.md) à la racine du dépôt : l'assistant le lit automatiquement.

Référence : [Cahier des charges](CAHIER_DES_CHARGES.md).

---

## Prompt de maquettes (optionnel, avant le lot 1)

```text
Propose les maquettes basse fidélité des écrans de Suivi_eleve : tableau de bord administrateur, fiche élève (onglets Identité, Tuteurs, Appareils, Notes, Comportement, Paiements), formulaire de libération anticipée avec suivi des envois, accueil de l'application parents. Public : parents peu habitués au numérique, connexion 3G. Une maquette par écran, avec les actions principales et les états vides.
```

## Prompt 1 — Initialisation

```text
Crée un monorepo pnpm "suivi_eleve" avec trois applications : /api (NestJS + Prisma + PostgreSQL), /web (Next.js App Router + Tailwind), /mobile (Expo React Native, TypeScript). Ajoute docker-compose avec PostgreSQL et Redis, un .env.example, ESLint/Prettier communs et un README qui explique comment tout lancer en local. Ne code aucune fonctionnalité métier pour l'instant.
```

## Prompt 2 — Schéma de base de données

```text
Dans /api, écris le schéma Prisma complet selon le modèle de la section 4 de docs/CAHIER_DES_CHARGES.md : Eleve, Tuteur, EleveTuteur, Classe, AnneeScolaire, Appareil, IncidentAppareil, Matiere, Evaluation, Note, Resultat, Comportement, Frais, Echeance, Paiement, Annonce, Notification, Utilisateur, JournalAudit. Utilise des enums Prisma pour les statuts et types, ajoute cree_le/modifie_le/cree_par partout, un champ ecole_id pour le multi-école futur, et les index utiles (matricule unique, imei, numero_serie). Génère la migration et un script de seed avec 2 classes, 20 élèves, 25 tuteurs et 10 appareils fictifs.
```

## Prompt 3 — Authentification et rôles

```text
Implémente l'authentification dans /api : connexion du personnel par email + mot de passe (argon2), connexion des parents par numéro de téléphone + code OTP à 6 chiffres envoyé par SMS (valide 5 minutes, 3 essais), jetons JWT d'accès (15 min) et de rafraîchissement (30 jours). Ajoute un garde de rôles (@Roles) et un garde "ParentOwnsEleve" qui refuse tout accès à un élève non rattaché au parent connecté. Écris les tests de ces gardes.
```

## Prompt 4 — Gestion des élèves et tuteurs

```text
Crée les modules Eleves, Tuteurs et Classes (API + pages web d'administration) : création, modification, archivage, changement de classe avec historique, recherche/filtre par nom, matricule, classe, tuteur, pagination. Le matricule est généré automatiquement au format SE-AAAA-NNNN. L'âge est calculé depuis la date de naissance. Contact_tuteur_1 obligatoire, Contact_tuteur_2 facultatif, numéros validés en E.164. Ajoute l'import et l'export Excel/CSV avec un rapport des lignes en erreur.
```

## Prompt 5 — Appareils des élèves

```text
Crée le module Appareils : enregistrement (type, marque, modèle, couleur, numéro de série, IMEI, signes distinctifs, photo), génération d'une étiquette QR code imprimable (PDF, 12 étiquettes par page A4), recherche par IMEI/numéro de série/QR/description, statuts (actif, perdu, trouvé, confisqué, restitué) avec historique IncidentAppareil. Ajoute le signalement "usage en classe" par un enseignant : il notifie le parent et, au-delà de N signalements par mois (paramètre), crée un Comportement négatif. Le scan du QR code ne montre le propriétaire qu'au personnel connecté.
```

## Prompt 6 — Moteur de notifications

```text
Crée un module Notifications générique utilisé par tous les autres modules. Interface : notifier({type, eleveIds|classeIds|toutEcole, donnees, priorite, canaux}). Il résout les tuteurs, applique leurs préférences (sauf types obligatoires), rend les modèles de messages avec variables ({prenom_eleve}, {classe}, {heure}, {motif}, {montant}), puis place les envois dans des files BullMQ par canal avec priorité (URGENTE passe en premier). Canaux derrière des interfaces : SmsProvider (implémentations Orange SMS API et Twilio, bascule si échec), EmailProvider (Brevo), PushProvider (Firebase Cloud Messaging). 3 essais avec délai croissant, bascule vers Contact_tuteur_2 si Contact_tuteur_1 échoue. Journalise chaque envoi (statut, coût, référence fournisseur) et reçois les accusés de délivrance par webhook. SMS limité à 160 caractères. Ajoute une page web pour modifier les modèles et consulter le journal.
```

## Prompt 7 — Absence de cours et libération anticipée

```text
Crée le module Annonces pour les types PAS_DE_COURS et LIBERATION_ANTICIPEE : formulaire web (cible : toute l'école, classes, ou un cours ; date, créneau ou heure de sortie ; motif obligatoire dans une liste + "autre"), envoi immédiat ou programmé. La libération anticipée est de priorité URGENTE (SMS + push en moins de 2 minutes). Affiche un suivi en temps réel : nombre de tuteurs notifiés, délivrés, échoués, ayant accusé réception. Exemple de SMS : "Suivi_eleve : les élèves de 6e A sont libérés à 11h00 (coupure d'électricité). Merci de prendre vos dispositions."

Ajoute aussi les absences des élèves : appel d'une classe (date, créneau, matière, absents cochés) par un enseignant ou la vie scolaire ; chaque absence non justifiée prévient aussitôt les tuteurs (notification ABSENCE obligatoire, SMS + email + application) ; pas de doublon pour un même élève, jour et créneau ; justification par la vie scolaire, motif transmis par le parent, suppression d'une saisie erronée ; carte « Absences » sur la fiche élève.
```

## Prompt 8 — Résultats et admission

```text
Crée les modules Matieres et Resultats, sans aucun calcul de note : la direction désigne le professeur de chaque matière dans chaque classe ; chaque professeur saisit pour sa matière la moyenne de chaque élève par période (/20) et une appréciation ; le professeur principal (ou la direction) saisit la moyenne générale, le rang et l'appréciation générale. Génère le bulletin PDF par élève à partir des saisies. Les résultats restent en brouillon jusqu'à publication par l'ADMIN (saisie des professeurs verrouillée ensuite) ; à la publication, notifier les parents (SMS : moyenne + rang ; email/app : bulletin). Ajoute la décision de fin d'année (ADMIS, REDOUBLE, EXCLU, ORIENTE), saisie puis publiée.
```

## Prompt 9 — Comportements marquants

```text
Crée le module Comportements : signalement positif ou négatif par un enseignant ou la vie scolaire (catégorie, gravité 1 à 3, description, sanction, convocation avec date). Gravité 3 : validation par l'ADMIN avant envoi au parent ; sinon envoi direct. Historique par élève visible par le parent. Formule les messages de façon factuelle et respectueuse.
```

## Prompt 10 — Rappels de paiement

```text
La comptabilité est tenue par l'école dans ses propres outils : ne crée ni frais, ni encaissements, ni reçus. Crée seulement des rappels de paiement : le COMPTABLE (ou l'ADMIN) choisit un élève et saisit le libellé (ex. « Mensualité d'octobre »), le montant en FCFA et la date de paiement normale ; le système calcule le retard en jours et prévient aussitôt les tuteurs (RAPPEL_PAIEMENT avant la date, RETARD_PAIEMENT après), en indiquant le total en attente si l'élève a plusieurs rappels ouverts. Le comptable peut relancer (retard recalculé) et marquer « réglé ». Liste des paiements en attente avec le retard de chacun et le total ; le parent voit ceux de ses enfants.
```

## Prompt 11 — Événements de l'école

```text
Crée le type d'annonce EVENEMENT : titre, description, date/heure, lieu, public cible, modalités d'organisation, pièce jointe, demande de réponse (participation ou autorisation parentale oui/non). Calendrier des événements côté web et mobile, rappel automatique la veille à 18h, tableau des réponses des parents.
```

## Prompt 12 — Application mobile parents

```text
Dans /mobile (Expo), crée l'application parents : connexion par numéro + OTP, choix de l'enfant si plusieurs, écrans Accueil (dernières notifications par icône de type), Notifications (liste + détail + accusé de réception), Résultats (moyennes publiées, bulletins PDF), Comportement, Absences (donner le motif), Paiements (rappels en attente et retard calculé, sans reçus : la comptabilité reste dans les outils de l'école), Appareils (liste, déclarer perdu), Événements (calendrier, répondre), Préférences (canaux par type). Notifications push via Firebase, cache hors ligne des 50 dernières notifications, interface simple en français avec gros boutons. Ajoute un mode PERSONNEL pour enseignants et surveillants : scan QR d'un appareil, signalement de comportement ou d'usage en classe.
```

## Prompt 13 — Espace parents web, sécurité et mise en production

```text
Ajoute dans /web l'espace parents (mêmes fonctions que le mobile). Puis fais une revue de sécurité : contrôle d'accès sur chaque route, limitation de débit sur l'OTP, en-têtes de sécurité, journal d'audit, consentement du tuteur stocké, export et effacement des données d'un élève sur demande. Enfin, prépare le déploiement : Dockerfiles, CI GitHub Actions (lint, tests, build), sauvegarde quotidienne chiffrée de PostgreSQL, guide de déploiement sur un VPS, et la configuration de publication Expo (EAS) pour Android et iOS.
```
