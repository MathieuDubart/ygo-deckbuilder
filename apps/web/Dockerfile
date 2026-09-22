# syntax=docker/dockerfile:1
# Contexte de build : racine du monorepo  →  docker build -f apps/web/Dockerfile .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# URL de l'API vue depuis le conteneur web (figée dans les rewrites au build)
ARG API_URL=http://api:4000
# Lien « code source » (AGPL-3.0) : ton fork si tu déploies une version modifiée
ARG SOURCE_URL=
ENV NEXT_PUBLIC_SOURCE_URL=$SOURCE_URL
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter "@ygo/web..."
RUN pnpm --filter @ygo/shared build && pnpm --filter @ygo/web build

FROM node:22-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
# Cache des images optimisées (persisté via volume)
RUN mkdir -p apps/web/.next/cache && chown -R node:node apps/web/.next/cache
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
