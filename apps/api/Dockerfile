# syntax=docker/dockerfile:1
# Contexte de build : racine du monorepo  →  docker build -f apps/api/Dockerfile .

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter "@ygo/api..."
RUN pnpm --filter @ygo/shared build && pnpm --filter @ygo/api generate && pnpm --filter @ygo/api build
# Bundle autonome : dist + node_modules de prod uniquement
RUN pnpm --filter @ygo/api deploy --prod --legacy /out \
  && rm -rf /out/dist && cp -r apps/api/dist /out/dist

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrations appliquées à chaque démarrage (idempotent), puis l'API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
