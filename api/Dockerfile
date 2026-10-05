# Image de production de l'API (contexte de construction : racine du dépôt).
#   docker build -f api/Dockerfile -t suivi-eleve-api .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
ENV CI=1

FROM base AS construction
# Manifestes d'abord : le cache Docker garde les dépendances tant qu'ils ne changent pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY mobile/package.json mobile/
# Le schéma est nécessaire au postinstall (prisma generate).
COPY api/prisma api/prisma
COPY api/prisma7.config.ts api/
RUN pnpm install --frozen-lockfile --filter @suivi-eleve/api...
COPY api/ api/
RUN pnpm --filter @suivi-eleve/api exec prisma generate --config prisma7.config.ts \
 && pnpm --filter @suivi-eleve/api build

FROM base AS execution
ENV NODE_ENV=production \
    API_PORT=3100 \
    STOCKAGE_DIR=/donnees/stockage
COPY --from=construction --chown=node:node /app /app
RUN mkdir -p /donnees/stockage && chown -R node:node /donnees
WORKDIR /app/api
USER node
EXPOSE 3100
# Migrations en attente appliquées à chaque démarrage, puis l'API.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --config prisma7.config.ts && exec node dist/main.js"]
