# YGO Deck Builder

Webapp self-hostable pour gérer sa collection Yu-Gi-Oh!, construire ses decks avec ce qu'on possède
vraiment, et savoir quels decks meta on peut monter (et combien coûte ce qui manque).

## Fonctionnalités (V1)

- **Comptes** multi-utilisateurs (Argon2id, JWT court + refresh token roté en cookie httpOnly)
- **Catalogue** complet synchronisé depuis [YGOPRODeck](https://ygoprodeck.com/api-guide/) (EN + noms FR), éditions, raretés, prix Cardmarket
- **Collection** par édition / état / langue / 1ère édition, import d'un produit entier (Structure Deck…), valeur estimée
- **Deck builder** : recherche limitée à tes cartes (ou tout le catalogue), validation live (40–60, 3 max, banlist, zone Extra), exemplaires manquants signalés, auto-save, import/export `.ydk`
- **Wishlist** : édition visée, budget max, priorité, lien vers le deck qui la réclame, « Je l'ai » → bascule en collection
- **Suggestions** : couverture de ta collection sur chaque deck meta de référence + coût pour compléter ; archétypes les plus fournis ; cartes possédées qui collent à un deck en cours

## Stack

| Couche | Choix |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Front | Next.js 16 (App Router), React 19, Tailwind 4, TanStack Query |
| API | NestJS 11 (Express), zod |
| DB | PostgreSQL 17 + Prisma 7 (driver adapter `pg`) |
| Contrats partagés | `packages/shared` : schémas zod, types DTO, règles de deck — utilisés par le front ET l'API |
| Déploiement | Docker Compose (db + api + web), un seul port exposé |

```
apps/
  api/                 NestJS
    prisma/            schéma + migrations
    src/
      common/          prisma, guards (JWT global, rôles), pipe zod, mappers
      config/          env validée au démarrage
      modules/
        auth/          register, login, refresh, logout, me
        cards/         recherche catalogue, fiche, archétypes, sets
        catalog-sync/  client + mapper YGOPRODeck, sync planifiée
        collection/    CRUD, import de set, stats, OwnershipService
        decks/         CRUD, import/export .ydk, validation
        wishlist/
        meta-decks/    decklists de référence (admin)
        suggestions/   coverage.ts (moteur pur, testé) + service
  web/                 Next.js
    src/
      app/             routes (auth) et (app)
      components/      ui/ (design system maison), cards/, layout/
      features/        une vue par domaine (catalog, collection, deck-builder…)
      lib/api/         client HTTP + hooks TanStack Query par domaine
packages/
  shared/              contrats front/back
  tsconfig/            configs TS partagées
```

Le navigateur ne parle qu'au front : `/api/*` est relayé par Next vers l'API. Cookies first-party,
pas de CORS, un seul domaine à exposer.

## Démarrer en local

Prérequis : Node 22+, Docker (pour Postgres), `corepack enable`.

```bash
pnpm install
pnpm db:up                                   # Postgres sur :5432
cp apps/api/.env.example apps/api/.env       # mets un vrai JWT_ACCESS_SECRET (openssl rand -base64 48)
cp apps/web/.env.example apps/web/.env
pnpm db:migrate                              # applique la migration initiale
pnpm cards:sync                              # ~13 000 cartes, quelques minutes
pnpm dev                                     # web :3000, api :4000
```

Mets ton email dans `ADMIN_EMAIL` avant de créer ton compte pour avoir le rôle admin.

## Déployer (VPS / selfhost)

```bash
cp .env.example .env          # remplis POSTGRES_PASSWORD, JWT_ACCESS_SECRET, PUBLIC_URL, ADMIN_EMAIL
docker compose up -d --build
```

- Les migrations s'appliquent au démarrage de l'API.
- Au premier démarrage, le catalogue vide déclenche une sync automatique (logs : `docker compose logs -f api`).
- Ensuite la sync tourne selon `CARD_SYNC_CRON` (lundi 4h par défaut) et ne fait rien si YGOPRODeck n'a pas bougé.
- Mets un reverse proxy HTTPS devant le port 3000 (voir `Caddyfile.example`). En HTTP pur, passe `COOKIE_SECURE=false`.

## Decks meta de référence

Pour l'instant, import par un admin depuis un `.ydk` :

```bash
curl -X POST https://ton-domaine/api/meta-decks/import-ydk \
  -H 'content-type: application/json' --cookie "ygo_at=…" \
  -d '{"name":"Snake-Eye","tier":1,"format":"TCG","ydk":"#main\n…"}'
```

(Une page d'admin est la prochaine étape.)

## Qualité

```bash
pnpm typecheck
pnpm test        # règles de deck, parser .ydk, mapper YGOPRODeck, moteur de couverture
pnpm build
```

## Roadmap

- [ ] Page admin : import de decks meta, statut de sync
- [ ] Moteur de synergie (au-delà de l'archétype : types, attributs, cartes citées, ratios starters/extenders)
- [ ] Quantités réelles des Structure Decks
- [ ] Recherche plein texte (`pg_trgm`) sur les effets
- [ ] Deck public partageable (lecture seule)
- [ ] Tests e2e (Playwright)
