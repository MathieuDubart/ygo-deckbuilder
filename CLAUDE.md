# Notes pour les agents IA

- Monorepo pnpm. Toujours `pnpm --filter <pkg>`. Après une modif de `packages/shared`, `pnpm --filter @ygo/shared build`.
- Les schémas zod de `packages/shared` sont la source de vérité des inputs : les réutiliser côté API (`ZodValidationPipe`) et côté web. Ne pas dupliquer.
- Toute requête sur des données utilisateur filtre par `userId`. Le guard JWT est global : une route publique doit être marquée `@Public()`.
- Prisma 7 : client généré dans `apps/api/src/generated/prisma` (ignoré par git), `prisma.config.ts` porte l'URL. Nouvelle migration : `pnpm --filter @ygo/api prisma:migrate --name <nom>`.
- Next 16 : `middleware` s'appelle `proxy` (`apps/web/src/proxy.ts`). Lire `node_modules/next/dist/docs` avant d'utiliser une API Next.
- Pas de `incremental` dans le tsconfig de l'API (casse `nest build` avec `deleteOutDir`).
- Logique métier pure (règles de deck, couverture) = fonctions sans I/O + tests vitest à côté.
- Scripts CLI : dans `apps/api/src/cli/` (compilés par `nest build`). Pas de `tsx` : esbuild n'émet pas les métadonnées de décorateurs, l'injection de dépendances Nest casse.
- Moteur meta = `apps/api/src/modules/meta-decks/engine/` (pur, sans Prisma). Fixture de vraies listes dans `fixtures.ts`.
- Moteur de synergie = `apps/api/src/modules/synergy/engine/` (pur) : `parse.ts` lit les textes PSCT (anglais), `graph.ts` liens/rôles/Extra, `combos.ts` simulation, `guide.ts` guide FR. Fixtures = vrais textes Blue-Eyes. Toute nouvelle tournure de texte → un test dans `parse.test.ts`.
- L'IA des guides est optionnelle (`AI_PROVIDER`) : le guide calculé doit toujours rester complet seul.
- Interactions entre cartes : `engine/interactions.ts` (cibles + précision) → table `CardEffectTarget` (`interaction-index.service.ts`). Après une évolution du lecteur de textes, incrémenter `INTERACTION_INDEX_VERSION` : l'index est reconstruit au démarrage.
- Produits possédés = module `products` (import, `OwnedProduct`, contenu). Quantités officielles lues à la demande sur Yugipedia (`set-list.parser.ts`, testé sur de vrais extraits) → `CardPrint.setQuantity` ; inconnues → 1 par carte. Les requêtes SQL communes aux produits sont dans `common/catalog/product-sql.ts`.
- i18n : 5 langues (`APP_LOCALES` dans `packages/shared`), cookie `NEXT_LOCALE` sinon Accept-Language, anglais par défaut. Front : next-intl sans préfixe d'URL, messages dans `apps/web/messages/<locale>/<namespace>.json` (l'anglais est la référence, clé manquante → anglais). API : `t()` / `translator()` (`common/i18n`), langue de la requête via AsyncLocalStorage ; noms/effets des cartes via `nameFr/descFr` + table `CardTranslation` (de, it, pt). Tout nouveau texte visible = une clé dans les 5 langues.
