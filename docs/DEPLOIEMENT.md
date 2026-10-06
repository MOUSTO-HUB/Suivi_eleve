# Mise en production de Suivi_eleve

Ce guide installe l'application sur un serveur loué (VPS) : site web, API, base de données, envois, sauvegardes chiffrées et HTTPS. Il prépare ensuite la publication de l'application mobile.

## 1. Ce qu'il faut avant de commencer

| Élément | Exemple / conseil |
| --- | --- |
| Un VPS Linux | Ubuntu 24.04, 2 vCPU, 4 Go de RAM, 40 Go de disque (OVH, Hetzner, Scaleway, DigitalOcean…) |
| Un nom de domaine | `suivi.mon-ecole.sn`, avec un enregistrement DNS **A** vers l'adresse IP du VPS |
| Un fournisseur SMS | Orange SMS API (Sénégal) ; Twilio en secours |
| Un compte email transactionnel | Brevo (adresse d'expédition vérifiée) |
| Un projet Firebase | pour les notifications push Android (compte de service) |

## 2. Préparer le serveur

Connecté en SSH avec un utilisateur qui a les droits `sudo` :

```bash
# Mises à jour automatiques de sécurité
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git ufw
sudo dpkg-reconfigure -plow unattended-upgrades

# Pare-feu : seulement SSH et le web
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Docker (dépôt officiel)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # puis se déconnecter / reconnecter
```

Recommandé : connexion SSH par clé uniquement (`PasswordAuthentication no` dans `/etc/ssh/sshd_config`).

## 3. Installer l'application

```bash
git clone https://github.com/MOUSTO-HUB/Suivi_eleve.git
cd Suivi_eleve
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Remplir au minimum :

- `DOMAINE` : le nom de domaine ;
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `WEBHOOK_SECRET` : valeurs aléatoires (`openssl rand -base64 48`) ;
- `SAUVEGARDE_PHRASE` : phrase secrète des sauvegardes, **à noter aussi hors du serveur** (coffre-fort de mots de passe) : sans elle, aucune sauvegarde ne peut être relue ;
- les fournisseurs SMS, email et push (voir § 6). En production, l'API refuse de démarrer avec les fournisseurs `console` ou `simulation`.

Démarrer (la première construction prend quelques minutes) :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Caddy obtient le certificat HTTPS tout seul (le DNS doit déjà pointer vers le serveur). Vérifier : `https://suivi.mon-ecole.sn/api/sante` doit répondre `{"statut":"ok"…}`.

Pour ne pas répéter les options, on peut créer un alias :

```bash
echo "alias suivi='docker compose -f ~/Suivi_eleve/docker-compose.prod.yml --env-file ~/Suivi_eleve/.env.production'" >> ~/.bashrc
source ~/.bashrc
# ensuite : suivi ps, suivi logs -f api, suivi restart web…
```

## 4. Première mise en service

Créer l'école, l'année scolaire (3 trimestres) et le compte de la direction — **une seule fois** :

```bash
suivi exec api node dist/cli/initialiser.js \
  --ecole "Collège Exemple de Dakar" \
  --prenoms "Awa" --nom "Diop" \
  --email direction@mon-ecole.sn \
  --annee 2026
```

La commande affiche un **mot de passe provisoire**. Ensuite, sur le site :

1. se connecter (onglet *Personnel de l'école*) puis changer le mot de passe (clic sur son nom → *Mon compte*) ;
2. menu **Personnel** : créer les comptes (secrétariat, enseignants, surveillants, comptabilité) ; chaque compte reçoit un mot de passe provisoire à lui transmettre ;
3. menu **Classes** puis **Élèves** : créer les classes, importer les élèves et tuteurs (modèle Excel fourni) ;
4. menu **Résultats → Matières** : matières et professeurs par classe.

Les parents n'ont **aucun compte à créer** : ils se connectent avec le numéro donné à l'école (code par SMS), sur le site ou dans l'application.

## 5. Sauvegardes

Le service `sauvegarde` fait chaque jour (par défaut à 2 h, heure de Dakar) :

- `sauvegardes/base-AAAAMMJJ-HHMM.dump.gpg` : la base complète ;
- `sauvegardes/fichiers-AAAAMMJJ-HHMM.tar.gz.gpg` : photos et pièces jointes.

Les fichiers sont chiffrés (AES-256) avec `SAUVEGARDE_PHRASE` et gardés `SAUVEGARDE_JOURS` jours.

**Copie hors du serveur (indispensable)** : une panne ou une erreur chez l'hébergeur emporterait aussi les sauvegardes locales. Copier le dossier chaque jour ailleurs, par exemple avec `rclone` vers un stockage objet ou un autre serveur :

```bash
# Exemple de tâche cron (crontab -e) à 3 h : copie vers un stockage configuré avec « rclone config »
0 3 * * * rclone copy ~/Suivi_eleve/sauvegardes distant:suivi-sauvegardes --max-age 48h
```

Sauvegarde immédiate (avant une mise à jour par exemple) :

```bash
suivi exec sauvegarde sauvegarde.sh maintenant
```

Restaurer la base (remplace les données actuelles : arrêter l'API d'abord) :

```bash
suivi stop api web
suivi run --rm --entrypoint restaurer.sh sauvegarde /sauvegardes/base-20261005-0200.dump.gpg
suivi start api web
```

Restaurer les fichiers :

```bash
gpg -d sauvegardes/fichiers-20261005-0200.tar.gz.gpg | \
  docker run --rm -i -v suivi_eleve_prod_stockage:/donnees/stockage alpine tar -C /donnees -xzf -
```

Faire un essai de restauration au moins une fois par trimestre (sur une base de test).

## 6. Fournisseurs d'envoi

| Variable | Où l'obtenir |
| --- | --- |
| `ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET`, `ORANGE_NUMERO_EXPEDITEUR` | Portail Orange Developer, offre *SMS Sénégal* |
| `TWILIO_*` | Console Twilio (secours) |
| `BREVO_API_KEY`, `EMAIL_EXPEDITEUR` | Brevo → *SMTP & API* ; expéditeur vérifié |
| `FCM_PROJET_ID`, `FCM_EMAIL_COMPTE_SERVICE`, `FCM_CLE_PRIVEE` | Firebase → *Paramètres du projet → Comptes de service → Générer une clé privée* (champs `project_id`, `client_email`, `private_key`) |

Accusés de livraison (statut « délivré » dans le journal des notifications) : déclarer chez chaque fournisseur l'URL `https://DOMAINE/api/notifications/webhooks/<fournisseur>?jeton=WEBHOOK_SECRET` (`orange`, `twilio`, `brevo`).

## 7. Mettre à jour

```bash
cd ~/Suivi_eleve
suivi exec sauvegarde sauvegarde.sh maintenant
git pull
suivi up -d --build
```

Les migrations de la base sont appliquées automatiquement au démarrage de l'API. Vérifier ensuite `suivi logs --tail 50 api`.

## 8. Surveiller

- État des services : `suivi ps` ; journaux : `suivi logs -f api` (taille limitée automatiquement).
- Santé de l'API : `https://DOMAINE/api/sante` (à brancher sur un service de surveillance gratuit, ex. UptimeRobot).
- Dans le site : **Notifications** (envois, échecs, coût des SMS) et **Journal** (connexions, exports, effacements).

## 9. Sécurité en place

- HTTPS partout (Caddy, HSTS) ; en-têtes de sécurité sur le site et l'API (CSP, anti-iframe, nosniff).
- Mots de passe hachés (argon2) ; jetons d'accès de 15 minutes, jetons de rafraîchissement révocables.
- Limitation des tentatives : connexion (10 par compte, 20 par adresse IP / 15 min), codes SMS (3 par numéro / 15 min, 10 par IP / heure, 3 essais par code).
- Contrôle d'accès vérifié automatiquement sur **chaque route** de l'API (test `api/test/securite.e2e-spec.ts`) ; un parent ne voit que ses enfants.
- Journal d'audit (avec l'IP) : connexions, créations, modifications, exports, effacements.
- Consentement du tuteur demandé et stocké (date et version du texte) à la première connexion.
- Droits des familles : sur la fiche de l'élève, la direction exporte toutes ses données (JSON) et, après son départ (dossier archivé), les efface (anonymisation).

## 10. Application mobile (Expo EAS)

Les builds se font dans le cloud d'Expo : aucun Mac ni Android Studio n'est nécessaire.

### Préparation (une fois)

```bash
cd mobile
npx eas-cli@latest login          # compte Expo gratuit
npx eas-cli@latest init           # relie le projet (ajoute extra.eas.projectId à app.json)
```

Dans `mobile/eas.json`, remplacer `https://suivi.mon-ecole.sn/api` par l'adresse réelle de l'API.

Push Android : dans Firebase, ajouter une application Android `com.suivieleve.app`, télécharger `google-services.json`, puis :

```bash
npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment production --environment preview --environment development
```

### Android

```bash
# APK à installer directement sur les téléphones du pilote (lien de téléchargement)
npx eas-cli@latest build -p android --profile preview

# Version Play Store (fichier AAB), puis envoi en test interne
npx eas-cli@latest build -p android --profile production
npx eas-cli@latest submit -p android --profile production
```

La publication sur Google Play demande un compte développeur Google (25 $, une seule fois).

### iPhone

La publication iOS (TestFlight, App Store) exige un compte **Apple Developer Program (99 $/an)** :

```bash
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production
```

À savoir : sur iPhone, l'application reçoit un jeton push Apple (APNs), alors que l'API envoie les push par Firebase. Pour les push iOS, il faudra soit ajouter le SDK Firebase Messaging à l'application, soit ajouter à l'API un fournisseur « Expo Push ». En attendant, les parents sur iPhone reçoivent SMS, emails et messages dans l'application.

### Mises à jour de l'application

Une correction du code JavaScript peut être envoyée sans repasser par les stores :

```bash
npx eas-cli@latest update --channel production --message "Correction …"
```

## 11. Site installable (PWA)

Le site s'installe comme une application, sans passer par un store :

- **PC (Chrome, Edge)** : bouton **Installer** dans le bandeau vert en haut du site, ou icône d'installation dans la barre d'adresse.
- **Android (Chrome)** : bouton **Installer** du bandeau, ou menu ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**.
- **iPhone, iPad (Safari)** : bouton **Partager** → **Sur l'écran d'accueil** (le bandeau l'explique). L'application s'ouvre alors en plein écran.

Il faut que le site soit servi en **HTTPS** (c'est le cas avec Caddy). Le service worker (`web/public/sw.js`) n'affiche qu'une page « hors ligne » quand internet manque : aucune page ni donnée d'élève n'est gardée en cache sur l'appareil. Pour forcer la mise à jour des fichiers mis en cache, changer `CACHE` dans `sw.js`.
