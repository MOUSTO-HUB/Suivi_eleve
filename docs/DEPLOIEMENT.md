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

Recommandé : connexion SSH par clé uniquement.

```powershell
# Sur le PC (PowerShell) : créer la clé (phrase secrète conseillée) et l'envoyer au serveur
ssh-keygen -t ed25519 -C "suivi-eleve"
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@SERVEUR "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Une fois la connexion par clé vérifiée, et en gardant une session ouverte, couper le mot de passe sur le serveur. Le fichier `00-…` est lu avant `50-cloud-init.conf`, qui réactive souvent le mot de passe (la première valeur lue l'emporte) :

```bash
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\n' | sudo tee /etc/ssh/sshd_config.d/00-cle-seulement.conf
sudo sshd -t && sudo systemctl reload ssh
```

Contrôle depuis le PC : `ssh -o PubkeyAuthentication=no ubuntu@SERVEUR` doit répondre `Permission denied (publickey)`. Clé perdue : console de secours de l'hébergeur (KVM OVH).

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

**Phase d'essai sans fournisseurs** (comptes SMS, email, Firebase pas encore ouverts) : `ENVOIS_SIMULES=oui`, `SMS_FOURNISSEUR=console`, `SMS_FOURNISSEUR_SECOURS=` (vide), `EMAIL_FOURNISSEUR=console`, `PUSH_FOURNISSEUR=console`. Aucun message ne part : ils sont écrits dans les logs, y compris les codes de connexion des parents (`suivi logs api | grep 'connexion est'`), les codes de double authentification du personnel et les liens « mot de passe oublié » (`suivi logs api | grep -E 'Code de connexion|jeton='`). Les notifications du site installé (Web Push) fonctionnent, elles, réellement. Repasser à `ENVOIS_SIMULES=non` avec de vrais fournisseurs avant d'accueillir des familles.

**Sans nom de domaine** : `DOMAINE` peut être le nom fourni par l'hébergeur, par exemple `vps-1a2b3c4d.vps.ovh.net` (espace client OVH, page du VPS). Le certificat HTTPS est obtenu de la même façon. Passer à un vrai domaine plus tard : changer `DOMAINE`, puis `suivi up -d` ; le faire avant d'imprimer des étiquettes QR ou de publier l'application mobile, qui contiennent l'adresse.

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

Créer **ton compte de concepteur** (super administrateur), une seule fois :

```bash
suivi exec api node dist/cli/initialiser.js \
  --prenoms "Prénom" --nom "Nom" \
  --email moi@mon-domaine.com
```

La commande affiche un **mot de passe provisoire**. Mot de passe oublié : relancer la même commande avec le même email (sans `--prenoms`/`--nom`) donne un nouveau mot de passe provisoire. La même commande réactive le compte concepteur s'il a été désactivé après trop d'essais incorrects, ou si le téléphone de la double authentification est perdu (retour au code par email).

La double authentification est **obligatoire** pour le concepteur, la direction et la comptabilité : à chaque connexion, un code à 6 chiffres est envoyé par email (en phase d'essai, il est dans les logs, voir plus haut). Dans *Mon compte*, chacun peut passer à une application d'authentification (Google ou Microsoft Authenticator) et noter ses codes de secours.

Sur le site, se connecter (onglet *Personnel de l'école*) : on arrive dans l'**espace concepteur**. Changer d'abord le mot de passe (clic sur son nom → *Mon compte*), puis pour chaque école abonnée :

1. **Nouvelle école** : nom, pays (Guinée, Côte d'Ivoire, Sénégal), compte de la direction. L'école démarre avec **1 mois d'essai gratuit** ; son année scolaire et ses 3 trimestres sont créés. Le mot de passe provisoire de la direction s'affiche une seule fois : le lui transmettre.
2. À chaque paiement reçu (Orange Money, MTN, Wave, virement, espèces) : fiche de l'école → **Enregistrer un paiement reçu** (150 000 GNF le mois, 1 500 000 GNF l'année). L'abonnement est prolongé aussitôt.
3. Le **tableau de bord** liste les écoles à relancer. La direction voit un bandeau 7 jours avant la fin ; après 15 jours de retard l'école est suspendue (plus de connexion ni d'envoi, données conservées) jusqu'au paiement. Une école peut aussi être suspendue ou réactivée à la main.

Mettre dans `.env.production` le contact affiché aux écoles pour renouveler : `CONTACT_ABONNEMENT="+224 6xx xx xx xx (WhatsApp)"`.

La direction de chaque école, sur le site :

1. se connecter puis changer le mot de passe (clic sur son nom → *Mon compte*) ;
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
| `VAPID_CLE_PUBLIQUE`, `VAPID_CLE_PRIVEE`, `VAPID_SUJET` | Notifications du site installé (voir section 11). Clés à générer une seule fois : `suivi run --rm api node dist/cli/cles-vapid.js` ; `VAPID_SUJET` = `mailto:` + adresse de contact de l'école |

Accusés de livraison (statut « délivré » dans le journal des notifications) : déclarer chez chaque fournisseur l'URL `https://DOMAINE/api/notifications/webhooks/<fournisseur>?jeton=WEBHOOK_SECRET` (`orange`, `twilio`, `brevo`).

## 7. Mettre à jour

Une seule commande, après chaque nouvelle version poussée sur GitHub :

```bash
sh ~/Suivi_eleve/deploy/mettre-a-jour.sh
```

Elle fait une sauvegarde chiffrée de sécurité, récupère la dernière version (`git pull`), reconstruit et redémarre (`suivi up -d --build`, coupure de quelques dizaines de secondes), supprime les anciennes images, puis vérifie que l'API répond ; sinon elle affiche ses derniers messages. Les migrations de la base sont appliquées automatiquement au démarrage de l'API et les données sont conservées.

Revenir à la version précédente en cas de problème : `cd ~/Suivi_eleve && git log --oneline -5`, puis `git checkout <version>` et `suivi up -d --build` (revenir ensuite sur la branche avec `git checkout main`).

## 8. Surveiller

- État des services : `suivi ps` ; journaux : `suivi logs -f api` (taille limitée automatiquement).
- Santé de l'API : `https://DOMAINE/api/sante` (à brancher sur un service de surveillance gratuit, ex. UptimeRobot).
- Dans le site : **Notifications** (envois, échecs, coût des SMS) et **Journal** (connexions, exports, effacements).

## 9. Sécurité en place

- HTTPS partout (Caddy, HSTS) ; en-têtes de sécurité sur le site et l'API (CSP, anti-iframe, nosniff).
- Mots de passe hachés (argon2) ; jetons d'accès de 15 minutes, jetons de rafraîchissement révocables.
- « Je ne suis pas un robot » (ALTCHA, calculé sur le serveur lui-même, sans service extérieur) sur la connexion, la demande de code SMS et le mot de passe oublié.
- Blocage progressif du personnel : 3 essais incorrects → 30 minutes ; puis 3 heures ; puis compte désactivé, réactivé par la direction (menu *Personnel*), par le concepteur pour la direction (fiche de l'école), par la commande `initialiser` pour le concepteur.
- Double authentification : application d'authentification ou code par email ; obligatoire pour le concepteur, la direction et la comptabilité. Les clés des applications sont chiffrées en base avec une clé tirée de `JWT_SECRET` : **ne jamais changer `JWT_SECRET`** une fois l'application en service (sinon chacun doit refaire l'ajout de son application).
- Mot de passe oublié : lien par email, valable 30 minutes et une seule fois ; toutes les sessions sont alors fermées.
- Limitation des tentatives : connexion (10 par compte, 20 par adresse IP / 15 min), codes SMS (3 par numéro / 15 min, 10 par IP / heure, 3 essais par code), codes de double authentification (3 essais par code, 3 codes non utilisés par quart d'heure).
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

À savoir : sur iPhone, l'application native reçoit un jeton push Apple (APNs), alors que l'API envoie ses push par Firebase : pour des push dans l'application native iOS, il faudra ajouter le SDK Firebase Messaging ou un fournisseur « Expo Push ». En attendant, les parents sur iPhone ont les notifications du **site installé** (section 11), en plus des SMS, emails et messages.

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

### Notifications sur le site installé (Web Push)

Une fois les clés VAPID configurées (section 6), le parent ouvre **Préférences** → **Activer les notifications** : il reçoit alors une alerte dès que l'école envoie un message, même site fermé. Le clic ouvre le message.

- **PC et Android** : fonctionne dans Chrome, Edge et Firefox, installé ou non.
- **iPhone et iPad** (iOS 16.4 ou plus) : seulement depuis l'icône ajoutée à l'écran d'accueil ; la page l'explique au parent.
- Le message est chiffré de bout en bout jusqu'au navigateur (seul l'appareil du parent peut le lire). L'API n'envoie qu'aux services push des navigateurs (Google, Mozilla, Apple, Microsoft).
- Un abonnement est coupé quand le parent se déconnecte, et supprimé automatiquement quand le navigateur le retire. Les préférences « Application » du parent s'appliquent aussi à ces notifications.
