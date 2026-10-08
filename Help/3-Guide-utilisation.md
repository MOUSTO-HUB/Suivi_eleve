# Guide d'utilisation de Suivi_eleve

> Comment se servir de l'application, **rôle par rôle** : concepteur, direction, secrétariat, enseignant, surveillant, comptable et parent. Il couvre le site web, le site installé sur un téléphone et l'application mobile.
>
> État au 8 octobre 2026 : application en **phase d'essai** sur le serveur `https://vps-5fbc9b26.vps.ovh.net` (il n'y a pas encore de nom de domaine). Les SMS, emails et notifications ne partent pas encore vraiment : ils sont écrits dans le journal du serveur (voir §11).

---

## Sommaire

1. [Présentation rapide](#1-présentation-rapide)
2. [Se connecter](#2-se-connecter)
3. [Ce qui est commun à tous](#3-ce-qui-est-commun-à-tous)
4. [Le concepteur (super administrateur)](#4-le-concepteur-super-administrateur)
5. [La direction (ADMIN)](#5-la-direction-admin)
6. [Le secrétariat / la vie scolaire](#6-le-secrétariat--la-vie-scolaire)
7. [L'enseignant](#7-lenseignant)
8. [Le surveillant](#8-le-surveillant)
9. [Le comptable](#9-le-comptable)
10. [Le parent](#10-le-parent)
11. [Le serveur : mise à jour, codes SMS de test, sauvegardes](#11-le-serveur--mise-à-jour-codes-sms-de-test-sauvegardes)
12. [Questions fréquentes](#12-questions-fréquentes)

---

## 1. Présentation rapide

Suivi_eleve prévient les parents, **en quelques minutes**, de tout ce qui concerne leurs enfants : sortie plus tôt que prévu, cours annulés, absence, comportement, résultats, paiements en attente, événements de l'école. Les messages partent par **SMS**, **email** et **notification** sur le téléphone, et restent consultables dans l'espace parents.

**Qui fait quoi**

| Rôle              | Où                                | Principales actions                                                                                                                         |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Concepteur        | Site web, espace « Plateforme »   | Crée les écoles et leur direction, enregistre les paiements d'abonnement, suspend ou réactive une école. Ne voit **aucune** donnée d'élève. |
| Direction (ADMIN) | Site web                          | Tout ce que fait le secrétariat, plus : comptes du personnel, publication des résultats, validation des cas graves, journal, abonnement     |
| Secrétariat       | Site web                          | Inscrit les élèves et tuteurs, gère les classes, les appareils, les annonces et les événements                                              |
| Enseignant        | Site web, mobile                  | Fait l'appel, saisit les moyennes, signale un comportement, confisque un appareil                                                           |
| Surveillant       | Mobile (et site)                  | Scanne les étiquettes des appareils, déclare trouvé / confisqué / restitué, fait l'appel                                                    |
| Comptable         | Site web                          | Signale les paiements en attente, relance, marque « Réglé »                                                                                 |
| Parent            | Mobile, site web ou site installé | Lit les messages, consulte résultats, absences, comportement, paiements, répond aux événements, choisit ses canaux                          |

**Règles importantes**

- Un parent ne voit **que ses enfants**.
- Un élève n'est **jamais supprimé** : il est **archivé** (et peut être restauré).
- Les numéros de téléphone sont enregistrés au format international (`+224…`, `+225…`, `+221…`). Un numéro saisi sans indicatif reçoit celui du pays de l'école.
- Les montants sont dans la monnaie du pays de l'école : **GNF** (Guinée) ou **FCFA** (Côte d'Ivoire, Sénégal).

---

## 2. Se connecter

Ouvrir l'adresse du site. La page de connexion a **deux onglets**.

### 2.1 Personnel de l'école (et concepteur)

1. Onglet **« Personnel de l'école »**.
2. Saisir son **email** et son **mot de passe**, puis **« Se connecter »**.
3. À la première connexion, le mot de passe est **provisoire** (donné par la direction, ou par le concepteur pour la direction) : le changer tout de suite dans **« Mon compte »** (10 caractères minimum).

Après 10 essais ratés sur un compte (ou 20 depuis une même connexion Internet) en 15 minutes, il faut attendre 15 minutes.

### 2.2 Parents

Les parents **n'ont pas de compte à créer** : il suffit que l'école ait enregistré leur numéro.

1. Onglet **« Parents »**.
2. Choisir le **pays**, saisir son **numéro de téléphone** (avec ou sans indicatif), puis **« Recevoir le code par SMS »**.
3. Saisir le **code à 6 chiffres** reçu par SMS. Il est valable **5 minutes** et accepte **3 essais**. On peut demander 3 codes par 15 minutes.
4. À la **première connexion**, lire le texte d'information sur l'usage des données et toucher **« J'ai lu et j'accepte »**.

Le numéro utilisé est celui du **contact 1** du tuteur (ou son contact 2). Si le message « un code a été envoyé » s'affiche mais que rien n'arrive, le numéro n'est peut-être pas celui enregistré par l'école : contacter le secrétariat.

### 2.3 Rester connecté

La session reste ouverte **30 jours** sur un appareil, puis il faut se reconnecter. Pour quitter : bouton **« Déconnexion »** (en haut sur le site, dans **Réglages** sur l'application mobile).

---

## 3. Ce qui est commun à tous

- **Mode clair / sombre** : bouton **☀️ / 🌙** dans le bandeau du haut. Le choix est gardé sur l'appareil.
- **Sur téléphone**, le menu du site se replie dans un bouton **« Menu »** sous le bandeau.
- **Changer son mot de passe** (personnel, concepteur) : **« Mon compte »**.
- **Installer le site** comme une application (PC, Android, iPhone) :
  - **PC / Android (Chrome, Edge)** : accepter le bandeau **« Installer »**, ou menu du navigateur → « Installer l'application ».
  - **iPhone / iPad (Safari)** : bouton **Partager** → **« Sur l'écran d'accueil »**. C'est obligatoire sur iPhone pour recevoir les notifications du site.
- **Sans réseau** : le site installé affiche une page « hors ligne » ; l'application mobile montre les derniers messages enregistrés sur le téléphone.

---

## 4. Le concepteur (super administrateur)

Le concepteur gère les **écoles abonnées**. Son compte a été créé sur le serveur avec la commande `node dist/cli/initialiser.js`. La même commande, relancée avec son email, lui donne un nouveau mot de passe provisoire s'il l'a oublié.

Après connexion (onglet « Personnel de l'école »), il arrive dans l'espace **Plateforme**.

### 4.1 Tableau de bord

Nombre d'écoles par état d'abonnement (essai, actif, à renouveler, en retard, suspendue), élèves et familles suivis (seulement des **nombres**), sommes encaissées ce mois-ci et cette année, liste des écoles à relancer.

### 4.2 Créer une école

**Écoles → « Nouvelle école »** : nom, pays (Guinée, Côte d'Ivoire, Sénégal), coordonnées, prénom(s), nom et email du directeur ou de la directrice → **« Créer l'école »**.

- L'école démarre avec **1 mois d'essai gratuit**.
- Son année scolaire (octobre à mi-juillet, 3 trimestres) et le compte de direction sont créés en même temps.
- Le **mot de passe provisoire** de la direction s'affiche **une seule fois** : le noter et le transmettre au directeur.

### 4.3 Enregistrer un paiement d'abonnement

Les paiements sont reçus **hors de l'application** (Orange Money, MTN Mobile Money, Wave, virement, espèces). Sur la fiche de l'école : **« Enregistrer le paiement »** avec la formule (**mensuelle : 150 000 GNF** ou **annuelle : 1 500 000 GNF**, hors taxes), la date, le moyen et la référence de la transaction.

- L'abonnement est prolongé d'1 mois ou d'1 an **à la suite** de la période précédente.
- Une erreur de saisie ? **Annuler le dernier paiement**.

### 4.4 Cycle de l'abonnement

| Moment               | Effet                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| 7 jours avant la fin | bandeau d'avertissement pour la direction de l'école                                                         |
| Après la fin         | **15 jours de grâce** : l'école fonctionne encore (« en retard »)                                            |
| Après la grâce       | **suspension automatique** : plus de connexion, plus de code SMS, plus de messages. Les données sont gardées |

### 4.5 Suspendre, réactiver, dépanner

- **« Suspendre »** une école à la main (avec un motif), puis **« Réactiver l'école »**.
- **Réinitialiser le mot de passe** d'un compte de direction (nouveau mot de passe provisoire affiché une fois).

---

## 5. La direction (ADMIN)

La direction a **tous les menus** du secrétariat (§6), plus les suivants.

### 5.1 Personnel

**Personnel → ajouter** : prénoms, nom, email (identifiant de connexion), rôle (Direction, Secrétariat, Enseignant, Surveillant, Comptable) → **« Créer le compte »**. Le **mot de passe provisoire** s'affiche **une seule fois** : le transmettre à la personne. On peut aussi désactiver un compte ou réinitialiser un mot de passe.

### 5.2 Publier les résultats et les décisions

Quand les professeurs ont saisi les moyennes (§7.2) : **Résultats** → choisir la période → **publier**. Les familles sont prévenues et voient les résultats et le bulletin PDF. En fin d'année : **Résultats → Décisions** (admis, redouble, exclu, orienté) → **« Publier les décisions et prévenir les familles »**.

### 5.3 Valider les cas graves de comportement

Un comportement de **gravité 3** signalé par un enseignant **attend** la direction : **Comportement** → ouvrir le signalement → **« Valider et prévenir la famille »** ou refuser (avec un motif).

### 5.4 Journal

**Journal** : toutes les actions sensibles (créations, modifications, archivages, connexions, exports) avec la date, l'auteur et l'adresse IP.

### 5.5 Abonnement

**Abonnement** : état, date de fin, tarifs et paiements enregistrés. Pour renouveler, payer le concepteur ; il enregistre le paiement.

### 5.6 Données d'un élève (demande d'une famille)

Sur la fiche de l'élève (direction seulement) :

- **Exporter les données (JSON)** : copie complète des données de l'élève et de ses tuteurs.
- **Effacer définitivement** (seulement un élève **archivé**, irréversible) : l'identité est anonymisée et le suivi supprimé.

---

## 6. Le secrétariat / la vie scolaire

### 6.1 Classes

**Classes → « Nouvelle classe »** : nom (ex. 6e A), niveau (ex. 6e), enseignant principal → **« Créer la classe »**. Sur la fiche d'une classe : élèves, et **matières enseignées** avec le professeur de chacune (c'est lui qui saisira les moyennes). Les matières et leurs coefficients se gèrent dans **Résultats → Matières**.

### 6.2 Inscrire un élève

**Élèves → « Inscrire »** : prénoms, nom, genre, date de naissance, classe, téléphone (facultatif), puis au moins un **tuteur** : prénoms, nom, lien (père, mère, tuteur légal, autre), **contact 1** (obligatoire), contact 2, email, langue des messages → **« Inscrire l'élève »**.

- Le **matricule** (`SE-2026-0001`) est attribué automatiquement.
- Si le contact 1 est déjà connu (frère ou sœur déjà inscrit), le **même tuteur** est réutilisé : il recevra un seul message pour tous ses enfants.

### 6.3 Importer une liste d'élèves

**Élèves → Importer** : télécharger le **modèle Excel**, le remplir, puis l'envoyer (Excel ou CSV, 2 000 lignes maximum).

- Colonnes : `prenoms`, `nom`, `genre`, `date_naissance`, `classe`, `telephone`, `tuteur_prenoms`, `tuteur_nom`, `lien_tuteur`, `contact_tuteur_1`, `contact_tuteur_2`, `email_tuteur`.
- Obligatoires : prénoms, nom, genre, date de naissance, prénoms, nom et contact 1 du tuteur.
- Dates acceptées : `15/03/2014`, `15-03-2014` ou `2014-03-15`. Numéros sans indicatif : celui du pays de l'école est ajouté.
- Un rapport indique les lignes importées et les erreurs **ligne par ligne**.

### 6.4 Gérer un élève

Sur la fiche de l'élève : **modifier**, **changer de classe** (l'historique est gardé), **ajouter ou retirer un tuteur**, **archiver** (départ de l'élève) ou **restaurer**. On y voit aussi ses appareils, absences, comportements et paiements en attente. **Exporter** la liste des élèves : bouton **« Exporter (Excel) »** sur la liste (avec les filtres en cours).

### 6.5 Tuteurs

**Tuteurs** : liste, recherche, fiche et modification (contacts, email, langue). Les tuteurs sont créés lors de l'inscription d'un élève.

### 6.6 Annonces : libération anticipée et pas de cours

**Annonces → « Libération anticipée »** ou **« Pas de cours »** :

1. Choisir le type, puis **toute l'école** ou des **classes**.
2. Date ; **heure de sortie** (libération) ou **créneau** (« toute la journée », « le matin », « l'après-midi »…).
3. Motif (grève, coupure d'électricité, intempéries, absence d'enseignant, autre + précision) et un message libre facultatif.
4. **Envoi immédiat** ou **programmé** (date et heure, au moins une minute plus tard et au plus 60 jours).
5. **« Prévenir les familles »** puis confirmer.

La page de l'annonce affiche le **suivi en temps réel** : nombre de familles prévenues, envois par canal (SMS, email, push) et liste des familles qui **n'ont pas encore lu**. Une annonce programmée peut être **annulée** ou **envoyée maintenant**. Ces messages sont **obligatoires** : ils partent même si le parent a coupé un canal.

### 6.7 Événements

**Événements → nouveau** : titre, date(s), lieu, modalités, public (école ou classes), **question aux parents** facultative (oui / non : participation, autorisation de sortie…), **pièce jointe** (PDF ou image). L'événement est créé en **brouillon** ; **« Publier l'événement »** prévient les familles. Un **rappel automatique** part la veille à 18 h. La page de l'événement montre les réponses (oui, non, sans réponse). **« Annuler l'événement »** prévient les familles déjà informées.

### 6.8 Appareils des élèves

- **Appareils → nouveau** : élève, type (téléphone, tablette, ordinateur), marque, modèle, couleur, numéro de série, **IMEI** (vérifié), signes distinctifs → **« Enregistrer l'appareil »**, puis **« Envoyer la photo »**.
- **Étiquettes** : imprimer la planche PDF (12 QR codes par page A4) pour un élève ou une classe, et coller l'étiquette sur l'appareil. Le nom de l'élève n'est **pas** imprimé : seul le personnel connecté voit le propriétaire en scannant.
- **Signalements** : perdu, trouvé, confisqué, restitué, usage en classe. Après plusieurs usages en classe dans le mois (3 par défaut, réglage `SEUIL_USAGE_APPAREIL_MOIS`), un comportement est créé automatiquement.

### 6.9 Absences (appel)

**Absences** : choisir la classe, la date et le créneau, cocher les absents → **« Enregistrer les absences »**. Pour chaque absence **non justifiée**, la famille est prévenue **aussitôt**. Ensuite : **justifier** une absence (avec le motif retenu, en tenant compte du motif envoyé par la famille) ou la **supprimer** si elle a été saisie par erreur.

### 6.10 Notifications

- **Notifications** : journal de tous les SMS, emails et push (destinataire, statut : en file, envoyé, délivré, échoué, lu ; erreur éventuelle), statistiques du mois et coût des SMS. Bouton **« Renvoyer »** pour un envoi échoué.
- **Notifications → Modèles** : modifier le texte de chaque message par type et par canal. Les mots entre accolades (`{prenom_eleve}`, `{classe}`, `{heure}`, `{motif}`, `{montant}`, `{monnaie}`…) sont remplacés à l'envoi. **« Rétablir le texte par défaut »** annule les changements.

---

## 7. L'enseignant

### 7.1 Faire l'appel

Comme §6.9 : **Absences**, cocher les absents, **« Enregistrer les absences »**.

### 7.2 Saisir les moyennes

**Résultats → Saisie** : choisir la classe et la matière (seulement celles qu'on enseigne), saisir la **moyenne sur 20** et une appréciation pour chaque élève → **« Enregistrer les moyennes »**. Le **professeur principal** saisit en plus la **moyenne générale**, le **rang** et l'appréciation générale (**« Enregistrer moyennes générales et rangs »**). L'application ne calcule **rien** : elle reprend ce que les professeurs saisissent. La direction publie ensuite (§5.2).

### 7.3 Signaler un comportement

**Comportement → nouveau** (ou écran « Signaler un comportement » de l'application mobile) : élève, positif (félicitations, encouragement) ou négatif (retard, indiscipline, fraude, violence…), gravité 1 à 3, description, sanction, convocation éventuelle des parents. Gravité 1 ou 2 : la famille est prévenue. Gravité 3 : la direction valide d'abord.

### 7.4 Appareil utilisé en classe

Sur l'appareil (scan ou recherche) : **« Usage en classe »** ou **« Confisqué »**.

---

## 8. Le surveillant

Surtout sur l'**application mobile** (connexion « Personnel » avec email et mot de passe).

1. **Scanner** : toucher « Scanner », autoriser la caméra, viser l'étiquette QR. On peut aussi **saisir le code** de 8 caractères imprimé sous le QR.
2. L'écran de l'appareil montre le **propriétaire** (élève, classe), la photo et le statut.
3. Choisir l'action : **trouvé**, **confisqué**, **restitué** (rendu à l'élève ou à la famille), **déclaré perdu**. La famille est prévenue.

Sur le site, **Appareils** permet de chercher un appareil par numéro de série, IMEI ou description. Le surveillant peut aussi faire l'appel et justifier les absences (§6.9).

---

## 9. Le comptable

La comptabilité reste tenue dans les outils de l'école ; Suivi_eleve sert seulement à **prévenir les familles**.

1. **Paiements → nouveau** : élève, libellé (ex. « Mensualité d'octobre »), **montant**, **date de paiement normale** → **« Prévenir la famille »**.
2. Le **retard** est calculé chaque jour à partir de la date normale.
3. **Relances automatiques** : 3 jours avant la date, le lendemain de la date, puis chaque semaine (4 relances automatiques au plus), chaque jour à 9 h.
4. **« Relancer »** : relance manuelle à tout moment (avec le retard du jour).
5. **« Réglé »** quand le paiement est reçu : plus aucune relance.
6. **Supprimer** un rappel saisi par erreur.

---

## 10. Le parent

### 10.1 Trois façons d'utiliser Suivi_eleve

| Façon                               | Pour qui                      | Notifications                   |
| ----------------------------------- | ----------------------------- | ------------------------------- |
| **Application mobile**              | Android (et iPhone plus tard) | push de l'application           |
| **Site installé** (écran d'accueil) | tous, y compris iPhone        | push du site, à activer (§10.4) |
| **Site web** dans le navigateur     | ordinateur ou dépannage       | non                             |

Dans tous les cas, les SMS et emails arrivent aussi.

### 10.2 L'accueil

- **« Bonjour … »** et, si on a plusieurs enfants, des **boutons pour choisir l'enfant**.
- Les **rubriques** : Résultats 📊, Comportement ⭐, Absences 📋, Paiements 💳, Appareils 📱, Événements 📅.
- Les **derniers messages** de l'école, avec le nombre de **non lus**.

Sur l'application mobile, **tirer l'écran vers le bas** pour actualiser. La barre du bas contient : **Accueil**, **Messages**, **Événements**, **Réglages**.

### 10.3 Les rubriques

- **Messages** : tous les messages de l'école. En ouvrir un le marque **lu** (l'école voit que vous l'avez lu).
- **Résultats** : moyennes par matière, moyenne générale, rang et appréciation, une fois **publiés** ; **bulletin PDF** à télécharger ou partager ; décision de fin d'année.
- **Absences** : liste des absences ; **envoyer un motif** à l'école (l'école décide ensuite de justifier).
- **Comportement** : félicitations, encouragements, incidents, convocations.
- **Paiements** : sommes en attente, date normale et retard.
- **Appareils** : appareils enregistrés de l'enfant ; **déclarer une perte** (« Où et quand l'avez-vous perdu ? »).
- **Événements** : réunions, sorties, fêtes, examens ; répondre **Oui / Non** à la question de l'école ; ouvrir la pièce jointe.

### 10.4 Choisir comment recevoir les messages

**Préférences** (dans Réglages sur le mobile) : pour chaque type de message, activer ou couper **SMS**, **email**, **push**.

- Les messages **importants** (sortie anticipée, pas de cours, absence, comportement, retard de paiement) sont **toujours envoyés** par tous les moyens : leurs interrupteurs sont bloqués.
- **Sur le site installé** : dans Préférences, activer les **notifications de cet appareil** (accepter la demande du navigateur). Sur iPhone, il faut d'abord **ajouter le site à l'écran d'accueil** (§3).

### 10.5 Données personnelles

Le texte accepté à la première connexion explique quelles données sont utilisées et pourquoi. Le parent peut demander à l'école une **copie** des données de son enfant, ou leur **effacement** après son départ (§5.6).

---

## 11. Le serveur : mise à jour, codes SMS de test, sauvegardes

À faire par le responsable technique, connecté en SSH au serveur (`ubuntu@vps-5fbc9b26.vps.ovh.net`).

| Besoin                                           | Commande                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Mettre à jour après un envoi sur GitHub          | `sh ~/Suivi_eleve/deploy/mettre-a-jour.sh`                              |
| Voir l'état des 6 services                       | `suivi ps`                                                              |
| Lire le journal de l'API                         | `suivi logs -f api` (Ctrl+C pour quitter)                               |
| **Lire le code SMS d'un parent** (phase d'essai) | `suivi logs api \| grep 'connexion est'`                                |
| Redémarrer le site                               | `suivi restart web`                                                     |
| Sauvegarde immédiate                             | `suivi exec sauvegarde sauvegarde.sh maintenant`                        |
| Vérifier que l'API répond                        | ouvrir `https://vps-5fbc9b26.vps.ovh.net/api/sante` → `{"statut":"ok"}` |

(`suivi` est un raccourci de `docker compose -f docker-compose.prod.yml --env-file .env.production`, à lancer dans `~/Suivi_eleve`.)

**Phase d'essai** (`ENVOIS_SIMULES=oui`) : aucun SMS, email ni push ne part réellement ; les messages et les **codes de connexion des parents** sont écrits dans le journal de l'API. Pour passer en réel, il faudra un fournisseur SMS par pays, un compte email (Brevo) et Firebase (voir `docs/DEPLOIEMENT.md`, §6).

**Sauvegardes** : chaque nuit à 2 h, base et photos chiffrées dans `~/Suivi_eleve/sauvegardes` (14 jours gardés). Copier régulièrement ce dossier **hors du serveur** et garder la phrase secrète en lieu sûr : sans elle, les sauvegardes sont illisibles.

---

## 12. Questions fréquentes

**Un parent dit qu'il ne reçoit pas le code.** Vérifier que son numéro est bien le **contact 1** (ou contact 2) d'un tuteur, au bon format, et que l'école n'est pas suspendue. En phase d'essai, le code est dans le journal du serveur (§11). Au-delà de 3 demandes en 15 minutes, il faut attendre.

**« Trop de tentatives. Réessayez dans 15 minutes. »** Protection contre les pirates : attendre le délai indiqué.

**Un message n'est pas parti.** **Notifications** : regarder le statut et l'erreur, puis **« Renvoyer »**. Un SMS qui échoue vers le contact 1 est automatiquement renvoyé vers le contact 2.

**Un parent avec trois enfants reçoit-il trois SMS ?** Non : un seul message qui cite tous ses enfants concernés.

**Peut-on supprimer un élève ?** Non : on l'**archive**. Seule la direction peut effacer les données d'un élève archivé, à la demande de la famille.

**« Accès refusé ».** Votre rôle ne permet pas cette page (ex. un enseignant sur « Personnel »). Demander à la direction.

**« L'accès est suspendu pour votre école ».** L'abonnement n'est pas à jour : la direction doit régler le concepteur, qui enregistre le paiement ; l'accès revient aussitôt.

**Les résultats n'apparaissent pas pour les parents.** Ils doivent être **publiés** par la direction (§5.2).

**Le site est en noir.** Le mode sombre est activé : toucher ☀️ dans le bandeau.

**Les notifications ne s'affichent pas sur iPhone.** Il faut ouvrir le site **depuis l'icône de l'écran d'accueil** (Partager → Sur l'écran d'accueil), puis les activer dans Préférences.
