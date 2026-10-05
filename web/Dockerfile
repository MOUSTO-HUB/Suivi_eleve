# Image de production du site (contexte de construction : racine du dépôt).
#   docker build -f web/Dockerfile -t suivi-eleve-web .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
ENV CI=1 NEXT_TELEMETRY_DISABLED=1

FROM base AS construction
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY mobile/package.json mobile/
RUN pnpm install --frozen-lockfile --filter @suivi-eleve/web...
COPY web/ web/
RUN mkdir -p web/public && pnpm --filter @suivi-eleve/web build

# Serveur autonome de Next (output: 'standalone') : seulement les fichiers utiles.
FROM node:22-alpine AS execution
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
COPY --from=construction --chown=node:node /app/web/.next/standalone ./
COPY --from=construction --chown=node:node /app/web/.next/static ./web/.next/static
COPY --from=construction --chown=node:node /app/web/public ./web/public
USER node
EXPOSE 3001
CMD ["node", "web/server.js"]
