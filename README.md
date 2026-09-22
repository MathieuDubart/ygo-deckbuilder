# YGO Deck Builder

A self-hostable web app to manage your Yu-Gi-Oh! collection, build decks with the cards you actually
own, see which meta decks you can put together (and what the missing cards cost), and learn how to
play them.

Available in **English, French, German, Italian and Portuguese** — interface, card names and effects,
and generated play guides.

## Features

- **Accounts** — multi-user, Argon2id passwords, short-lived JWT + rotated refresh token in an httpOnly cookie (or in the response body for native clients).
- **iOS app** — native SwiftUI client with a card scanner (separate `ygo-deckbuilder-iOS` repository).
- **Card catalog** — fully synced from [YGOPRODeck](https://ygoprodeck.com/api-guide/): names and effects in 5 languages, prints, rarities, Cardmarket prices. Typo-tolerant search in any language, or by the code printed on the card (`SDBE-EN001`).
- **Collection** — by print, condition, language and 1st edition, with an estimated value. Add a whole product (structure deck, tin, box…) from a gallery of HD box art, with the **official quantities** of each card (Yugipedia set lists).
- **Products** — every product you added, with its full content to rebuild it (what is missing, a copyable list), one-click deck creation, and a play guide for structure and starter decks.
- **Deck builder** — search limited to your cards (or the whole catalog), live validation (40–60 cards, 3 copies, banlist, Extra Deck), missing copies flagged, auto-save, `.ydk` import/export. Clicking a card opens its details with +/− per zone.
- **Card interactions** — on every card: what it searches, summons or uses as material, and which cards search, summon or use it. Your cards first, click to jump from card to card.
- **Automatic meta** — recent tournament top decks are clustered into archetypes by content, with a consensus list, flex cards, a tier and the meta share.
- **Deck suggestions & generation** — for each meta deck, your coverage and the cost to complete it; one-click generation of the full meta list or an "owned cards only" version; auto decks for any archetype you own; **official preconstructed decks** (structure decks, starters, the decks inside boxes such as *Legendary 5D's Decks* or the *2-Player Starter Set*) with what you own of each; a list of complete, playable decks built only from your collection, ranked by a solidity score. Missing cards go to the wishlist.
- **Synergy & play guides** — card effects are read (who searches, summons or sends what; starters, extenders, hand traps; which Extra Deck monsters are actually reachable). Generated decks favour cards that work together, and every deck gets a **play guide**: game plan, key cards, step-by-step combos, going first/second, mistakes to avoid. Optionally rewritten by an AI model (OpenAI-compatible or Anthropic, local models welcome).
- **Duel simulator** — test your decks with the **real card effects**: the [EDOPro](https://github.com/edo9300/ygopro-core) engine (compiled to WebAssembly) and the [Project Ignis](https://github.com/ProjectIgnis) card scripts run on the server. Force your opening hand, set up the opponent's board (monsters, set cards, hand traps, graveyard), then play against a passive opponent (combo testing) or make the opponent's choices yourself (interactions). Every summon type, chains, battle and the duel log are supported. A bot opponent is coming.
- **Rules reminder** — the official rules (current Master Rule) in 5 languages: turn structure, every summon type (Fusion, Ritual, Synchro, Xyz, Pendulum, Link), Extra Monster Zones, chains, battle.
- **Wishlist** — target print, max budget, priority, link to the deck that needs it, "Got it" moves it to the collection.

<!-- Screenshots to add in docs/screenshots/ (collection, deck-builder, card-interactions, suggestions, guide, products, languages):

## Screenshots

| | |
| --- | --- |
| ![Deck builder](docs/screenshots/deck-builder.png) | ![Card interactions](docs/screenshots/card-interactions.png) |
| **Deck builder** — card details with "In this deck" controls | **Card interactions** — what it does, who uses it |
| ![Suggestions](docs/screenshots/suggestions.png) | ![Play guide](docs/screenshots/guide.png) |
| **Suggestions** — playable decks from your collection | **Play guide** — combos and mistakes to avoid |
| ![Products](docs/screenshots/products.png) | ![Languages](docs/screenshots/languages.png) |
| **Products** — contents, what is missing, deck guide | **5 languages** — UI, card texts and guides |
-->

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js 16 (App Router), React 19, Tailwind 4, TanStack Query, next-intl |
| API | NestJS 11 (Express), zod |
| Database | PostgreSQL 17 + Prisma 7 (`pg` driver adapter) |
| Shared contracts | `packages/shared`: zod schemas, DTO types, deck rules, locales — used by both web and API |
| Deployment | Docker Compose (db + api + web), a single exposed port |

```
apps/
  api/                 NestJS
    prisma/            schema + migrations
    src/
      common/          prisma, guards (global JWT, roles), zod pipe, mappers, i18n, search
      config/          env validated at startup
      cli/             one-off scripts (card sync, meta sync, interaction index)
      modules/
        auth/          register, login, refresh, logout, me
        cards/         catalog search, card details, archetypes, products
        catalog-sync/  YGOPRODeck + Yugipedia clients, scheduled sync, product covers
        collection/    CRUD, stats, OwnershipService
        products/      product import, official quantities, owned products
        decks/         CRUD, .ydk import/export, validation
        wishlist/
        meta-decks/    tournament lists, meta engine (engine/), sync
        suggestions/   coverage, deck generation, playable decks
        synergy/       effect reader, synergy graph, combos, guides (engine/), card interactions
        duel/          duel simulator: EDOPro engine (WebAssembly), card data/scripts (data/), prompts & log (engine/)
  web/                 Next.js
    messages/          UI translations, one folder per language
    src/
      app/             routes: (auth) and (app)
      components/      ui/ (in-house design system), cards/, products/, layout/
      features/        one view per domain (catalog, collection, deck-builder, guide…)
      i18n/            next-intl setup (cookie, then browser language)
      lib/api/         HTTP client + TanStack Query hooks per domain
packages/
  shared/              web/API contracts
  tsconfig/            shared TS configs
```

The browser only talks to the web app: `/api/*` is proxied by Next to the API. First-party cookies,
no CORS, a single domain to expose.

Native clients (the iOS app) use the same `/api/*` routes with the `X-Auth-Mode: token` header:
`/auth/login`, `/auth/register` and `/auth/refresh` then return `{ user, accessToken, refreshToken, … }`
instead of setting cookies, the access token goes in `Authorization: Bearer …`, and the refresh token is
sent in the body of `/auth/refresh` and `/auth/logout`. Refresh tokens rotate; reusing one revokes the session.

## Running locally

Requirements: Node 22+, Docker (for Postgres), `corepack enable`.

```bash
pnpm install
pnpm db:up                                   # Postgres on :5432
cp apps/api/.env.example apps/api/.env       # set a real JWT_ACCESS_SECRET (openssl rand -base64 48)
cp apps/web/.env.example apps/web/.env
pnpm db:migrate
pnpm cards:sync                              # ~13,000 cards in 5 languages, a few minutes
pnpm dev                                     # web :3000, api :4000
```

Put your email in `ADMIN_EMAIL` before creating your account to get the admin role.

## Deploying (VPS / self-hosting)

```bash
cp .env.example .env          # fill POSTGRES_PASSWORD, JWT_ACCESS_SECRET, PUBLIC_URL, ADMIN_EMAIL
docker compose up -d --build
```

- Migrations run when the API starts.
- On first start, the empty catalog triggers an automatic sync (`docker compose logs -f api`).
- HD product covers and official product quantities come from Yugipedia (`PRODUCT_COVERS_ENABLED`).
- The sync then runs on `CARD_SYNC_CRON` (Mondays 4am by default) and does nothing if YGOPRODeck has not changed.
- Put an HTTPS reverse proxy in front of port 3000 (see `Caddyfile.example`). Over plain HTTP, set `COOKIE_SECURE=false`.

### Duel simulator

The duel engine needs the card scripts and databases from Project Ignis (~60 MB). The API downloads
them on first start into `DUEL_DATA_DIR` (a Docker volume, `duel-data`) and refreshes them on
`DUEL_DATA_CRON` (Tuesday 3 am by default); the page shows a waiting state until they are ready.
Each duel runs in memory on the API (a few MB); `DUEL_MAX_SESSIONS` caps simultaneous duels and idle
duels are closed after `DUEL_IDLE_MINUTES`. `DUEL_ENABLED=false` turns the simulator off.

There is no WebSocket: every answer to the engine is a plain HTTP request that returns the new state,
the log events and the next choice, so the simulator works behind any reverse proxy.

If you run a modified version, set `SOURCE_URL` to your fork (AGPL-3.0, see [License](#license)).

## Languages

English (default), French, German, Italian and Portuguese. The language comes from the `NEXT_LOCALE`
cookie set by the language switcher, then from the browser's `Accept-Language`, then English — for
the web UI and for everything the API generates (card names and effects, guides, notes, errors).
Card texts come from YGOPRODeck (French in `Card.nameFr/descFr`, German/Italian/Portuguese in
`CardTranslation`). UI strings live in `apps/web/messages/<locale>/<namespace>.json`; English is the
reference and missing keys fall back to it.

## Meta and deck generation

The meta is computed from the tournament decklists published by YGOPRODeck (*Tournament Meta Decks*):

1. the ~300 most recent lists are fetched (`META_SYNC_PAGES`), alternate artworks are resolved;
2. they are clustered into archetypes by **content** (Jaccard on the cards played), not by name;
3. for each archetype: a consensus list (cards by inclusion rate, at their most played copy count),
   *flex* cards, a tier based on meta share;
4. **staples** (cards played across archetypes: hand traps, board breakers) are used to complete
   decks generated from your collection.

It runs on first start, then on `META_SYNC_CRON` (Mondays 5am), or manually with `pnpm meta:sync` or
the "Update" button on the Suggestions page (admin). The engine
(`apps/api/src/modules/meta-decks/engine/`) is made of pure functions tested on real lists. Meta decks
can also be imported from a `.ydk` file (`POST /api/meta-decks/import-ydk`, admin).

## Synergy and play guides

`apps/api/src/modules/synergy/engine/` reads the official card text (Konami's PSCT format):

- **effects**: searches, special summons from the Deck / hand / GY, sends to the GY, triggers
  (Normal Summon, sent to the GY, End Phase…), "discard this card" costs;
- **graph**: A → B when an effect of A can search / summon / send B in this deck;
- **roles**: starter, extender, searcher, hand trap, interruption, removal, draw, boss;
- **Extra Deck**: Fusion / Synchro / Xyz / Link materials checked against the Main Deck;
- **combos**: a simplified simulation from 1–2 card hands to an end-of-turn boss.

Deck generation uses it (cards ranked by affinity with the deck core, unreachable Extra Deck monsters
removed, a *synergy* component and a minimum number of starters in the solidity score), and
`POST /api/suggestions/guide` produces the play guide shown under generated decks, in the deck
builder and on product pages.

**Optional AI** to write the guide (the computed guide stays the baseline and the fallback):

```bash
AI_PROVIDER=openai            # any OpenAI-compatible API: OpenAI, Mistral, Groq, LM Studio, Ollama…
AI_BASE_URL=http://localhost:1234/v1   # e.g. LM Studio (from Docker: http://host.docker.internal:1234/v1)
AI_MODEL=qwen2.5-14b-instruct
# or: AI_PROVIDER=anthropic, AI_API_KEY=…, AI_MODEL=…
```

Answers are validated with zod and cached in the database (`DeckGuideCache`) per list, model and
language. Writing happens in the background (one at a time) and the UI polls every 3 s, so there are no
proxy timeouts even with a slow local model. API-side limit: `AI_TIMEOUT_MS` (3 min by default).

**Card interactions**: after each catalog sync, the *precise* targets of every card (a quoted name or
archetype, or a tight filter such as "Level 1 LIGHT Tuner") are indexed in `CardEffectTarget` (a few
seconds for the whole catalog). A card page computes its own targets on the fly and queries the index
for the reverse question (`GET /api/cards/:id/interactions`). Generic effects ("1 monster") are not
indexed: they target everything. Manual rebuild: `pnpm interactions:index` (automatic on start when the
text reader changes).

## Products

Adding a product records it (`OwnedProduct`) in addition to its cards. YGOPRODeck lists each card once
per product, so the official copy counts are read on demand from the Yugipedia *Set Card Lists* and
stored in `CardPrint.setQuantity` (1 copy per card when unknown). The product page shows what is still
in your collection, a copyable list to rebuild it, and — for structure and starter decks — the play
guide and one-click deck creation.

The same set lists feed the **official decks**: every section of a product page titled "… Deck"
becomes a `ProductDeck` (a structure deck is one deck, *Legendary Decks II* is three). A daily job
reads the structure decks, starters and boxes that have not been read yet. The Suggestions page lists
them with your coverage (filter: structure / starter / box) and builds them from the official list or
from your cards only.

## Quality

```bash
pnpm typecheck
pnpm test        # deck rules, .ydk, search, locales, YGOPRODeck/Yugipedia parsing, meta engine, synergy engine, product quantities, duel engine bridge
pnpm build
```

## Roadmap

- [ ] Admin page: meta deck import, sync status
- [x] Synergy engine (roles, card links, reachable Extra Deck, combos) + play guides
- [x] Real structure deck quantities (Yugipedia set lists)
- [x] Five languages
- [x] Duel simulator (EDOPro engine) + rules reminder
- [ ] Bot opponent in the duel simulator (WindBot)
- [ ] Opening-hand simulator (odds of opening each combo)
- [ ] Deck builder suggestions from the interaction index (owned cards linked to the deck, beyond its archetype)
- [ ] Shareable read-only public decks
- [ ] End-to-end tests (Playwright) in CI

## License

[AGPL-3.0-or-later](LICENSE). The duel simulator embeds the EDOPro engine (ygopro-core, AGPL-3.0),
so the whole application is distributed under the same license: if you run a modified version on a
server, you must offer its source code to its users (the duel page links to it through `SOURCE_URL`).

## Credits

Card data and images: [YGOPRODeck](https://ygoprodeck.com/). Product box art and set lists:
[Yugipedia](https://yugipedia.com/). Duel engine: [ygopro-core](https://github.com/edo9300/ygopro-core)
(EDOPro, AGPL-3.0) through [ocgcore-wasm](https://www.npmjs.com/package/ocgcore-wasm) (MIT); card
scripts and databases: [Project Ignis](https://github.com/ProjectIgnis) (CardScripts, BabelCDB). Yu-Gi-Oh! is a trademark of Konami; this project is not affiliated
with or endorsed by Konami.
