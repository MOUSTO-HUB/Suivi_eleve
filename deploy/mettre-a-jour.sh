#!/bin/sh
# Met à jour Suivi_eleve sur le serveur, en une commande :
#   sh ~/Suivi_eleve/deploy/mettre-a-jour.sh
# 1. sauvegarde chiffrée de sécurité ; 2. dernière version depuis GitHub ;
# 3. reconstruction et redémarrage (les migrations de la base s'appliquent au
#    démarrage de l'API) ; 4. vérification que l'application répond.
set -eu
cd "$(dirname "$0")/.."
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "1/4 Sauvegarde de sécurité…"
$C exec -T sauvegarde sauvegarde.sh maintenant

echo "2/4 Récupération de la dernière version…"
git pull --ff-only

echo "3/4 Reconstruction et redémarrage (quelques minutes)…"
$C up -d --build
# Les anciennes images ne servent plus : on libère le disque.
docker image prune -f > /dev/null

echo "4/4 Vérification…"
DOMAINE=$(grep '^DOMAINE=' .env.production | cut -d= -f2)
essai=0
until curl -fsS "https://${DOMAINE}/api/sante" > /dev/null 2>&1; do
  essai=$((essai + 1))
  if [ "$essai" -ge 30 ]; then
    echo "L'API ne répond pas. Derniers messages :"
    $C logs --tail 40 api
    exit 1
  fi
  sleep 5
done
echo "Mise à jour terminée : $(git log -1 --format='%h %s')"
