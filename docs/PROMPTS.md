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

## Prompt 14 — Site installable et notifications Web Push

```text
Rends le site installable (PWA) sur PC, Android et iPhone : manifeste, icônes, service worker avec page hors ligne (aucune donnée d'élève en cache), bandeau d'installation (bouton natif, mode d'emploi sur iPhone). Ajoute les notifications Web Push du site : clés VAPID, abonnement du navigateur enregistré comme jeton push (plateforme WEB), envoi chiffré par le moteur de notifications vers les seuls services push des navigateurs, bouton d'activation dans les préférences du parent, clic qui ouvre le message, abonnement coupé à la déconnexion.
```

## Prompt 15 — Relances de paiement automatiques

```text
Ajoute une tâche quotidienne (BullMQ, 9h heure de Dakar) qui relance les familles sans action du comptable, tant qu'un rappel de paiement n'est pas réglé : rappel 3 jours avant la date, relance le lendemain de la date, puis 7 jours après le dernier envoi (manuel ou automatique), 4 relances automatiques au plus. Règle pure testée, compteur des relances automatiques, prochaine relance affichée au comptable.
```

## Prompt 16 — Espace concepteur et abonnements des écoles

```text
Ajoute le rôle SUPER_ADMIN (concepteur, sans école) et son espace web /plateforme : créer une école (pays Guinée, Côte d'Ivoire ou Sénégal) avec son année scolaire et son compte de direction, enregistrer les paiements d'abonnement (150 000 GNF par mois ou 1 500 000 GNF par an, hors taxes), suspendre ou réactiver, tableau de bord (écoles par état, encaissements). 1 mois d'essai, bandeau à la direction 7 jours avant la fin, 15 jours de grâce puis suspension : plus de connexion ni d'envoi, données conservées. Le concepteur n'accède à aucune route des écoles ni aux données des élèves. Premier compte concepteur par la ligne de commande.
```

## Prompt 17 — Écoles de Guinée, de Côte d'Ivoire et du Sénégal

```text
Rends l'application multi-pays : le pays de l'école (GN, CI, SN) fixe la monnaie des montants (GNF ou FCFA, variable {monnaie} des modèles de messages, site et application) et l'indicatif ajouté aux numéros saisis sans (+224, +225, +221 : import des élèves, aides à la saisie). À la connexion des parents (site et mobile), un choix du pays, retenu sur l'appareil, avec un pays par défaut configurable (PAYS_PAR_DEFAUT, EXPO_PUBLIC_PAYS_PAR_DEFAUT). Le profil /auth/moi donne le pays, la monnaie et l'indicatif de l'école.
```

## Prompt 18 — Design « bleu école » et choix clair / sombre

```text
Redessine le site web en « bleu école » : bandeau en dégradé bleu nuit vers bleu ciel, menu en pastilles à contour dégradé (pastille active pleine), repliable derrière un bouton « Menu » sur téléphone ; boutons en dégradé, cartes et tableaux arrondis, accents jaune soleil. Aucun champ ni grille ne dépasse la largeur d'un téléphone (texte des champs en 16 px pour l'iPhone). L'utilisateur choisit lui-même le mode clair ou sombre (bouton ☀️/🌙 dans le bandeau et sur la connexion, cookie « theme », clair par défaut), sans tenir compte du réglage de l'appareil ; en sombre, les nuances de couleur sont inversées dans globals.css. Même design et même bouton dans l'application mobile (lib/theme.tsx, choix gardé sur le téléphone), icônes de l'application à la toque bleue.
```
