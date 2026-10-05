#!/bin/sh
# Restaure une sauvegarde de la base (remplace les données actuelles !) :
#   docker compose -f docker-compose.prod.yml --env-file .env.production \
#     run --rm --entrypoint restaurer.sh sauvegarde /sauvegardes/base-AAAAMMJJ-HHMM.dump.gpg
set -eu

: "${SAUVEGARDE_PHRASE:?SAUVEGARDE_PHRASE est obligatoire}"
FICHIER="${1:?Indiquez le fichier, ex. /sauvegardes/base-20261005-0200.dump.gpg}"

PHRASE=$(mktemp)
chmod 600 "$PHRASE"
printf '%s' "$SAUVEGARDE_PHRASE" > "$PHRASE"
trap 'rm -f "$PHRASE"' EXIT

gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$PHRASE" -d "$FICHIER" \
  | pg_restore --clean --if-exists --no-owner -d "$PGDATABASE"
echo "Base restaurée depuis $FICHIER."
