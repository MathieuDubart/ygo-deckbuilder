# Notes pour les agents IA

- Monorepo pnpm. Toujours `pnpm --filter <pkg>`. Après une modif de `packages/shared`, `pnpm --filter @ygo/shared build`.
- Les schémas zod de `packages/shared` sont la source de vérité des inputs : les réutiliser côté API (`ZodValidationPipe`) et côté web. Ne pas dupliquer.
- Toute requête sur des données utilisateur filtre par `userId`. Le guard JWT est global : une route publique doit être marquée `@Public()`.
- Prisma 7 : client généré dans `apps/api/src/generated/prisma` (ignoré par git), `prisma.config.ts` porte l'URL. Nouvelle migration : `pnpm --filter @ygo/api prisma:migrate --name <nom>`.
- Next 16 : `middleware` s'appelle `proxy` (`apps/web/src/proxy.ts`). Lire `node_modules/next/dist/docs` avant d'utiliser une API Next.
- Pas de `incremental` dans le tsconfig de l'API (casse `nest build` avec `deleteOutDir`).
- Logique métier pure (règles de deck, couverture) = fonctions sans I/O + tests vitest à côté.
