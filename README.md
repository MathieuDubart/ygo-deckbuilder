# YGO Deck Builder

Webapp self-hostable pour gérer sa collection Yu-Gi-Oh!, construire ses decks avec ce qu'on possède
vraiment, et savoir quels decks meta on peut monter (et combien coûte ce qui manque).

## Fonctionnalités (V1)

- **Comptes** multi-utilisateurs (Argon2id, JWT court + refresh token roté en cookie httpOnly)
- **Catalogue** complet synchronisé depuis [YGOPRODeck](https://ygoprodeck.com/api-guide/) (EN + noms FR), éditions, raretés, prix Cardmarket
- **Collection** par édition / état / langue / 1ère édition, import d'un produit entier (Structure Deck, tin…) depuis une galerie de visuels HD (Yugipedia), valeur estimée
- **Deck builder** : recherche limitée à tes cartes (ou tout le catalogue), validation live (40–60, 3 max, banlist, zone Extra), exemplaires manquants signalés, auto-save, import/export `.ydk`
- **Wishlist** : édition visée, budget max, priorité, lien vers le deck qui la réclame, « Je l'ai » → bascule en collection
- **Meta automatique** : les tops de tournois récents (YGOPRODeck) sont regroupés en archétypes par similarité de contenu, avec une liste type par archétype, un tier et la part du meta
- **Suggestions & génération de decks** : pour chaque deck du meta, ta couverture et le coût pour compléter ; génération en un clic de la liste meta complète ou d'une version « avec mes cartes » (cœur de la liste, cartes flex, staples que tu possèdes) ; deck auto pour tout archétype de ta collection ; les manquantes partent en wishlist
- **Synergie & guides** : les effets des cartes sont lus (qui cherche / invoque / envoie quoi, starters, extenders, hand traps, Extra Deck réellement invocable) ; les decks générés privilégient les cartes qui s'emboîtent, et chaque deck a son **guide de jeu** : plan, cartes clés, combos pas à pas, en premier / en second, erreurs à éviter (rédaction par IA en option)
- **Exploration des cartes** : sur chaque fiche, ce que la carte va chercher / invoquer / utiliser, et quelles cartes la cherchent, l'invoquent ou l'utilisent comme matériau — tes cartes en premier, un clic pour naviguer de carte en carte

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
        meta-decks/    listes de tournoi, moteur meta (engine/), sync
        suggestions/   couverture, génération de decks
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
- Les visuels HD des produits sont récupérés sur Yugipedia en arrière-plan (`PRODUCT_COVERS_ENABLED`).
- Ensuite la sync tourne selon `CARD_SYNC_CRON` (lundi 4h par défaut) et ne fait rien si YGOPRODeck n'a pas bougé.
- Mets un reverse proxy HTTPS devant le port 3000 (voir `Caddyfile.example`). En HTTP pur, passe `COOKIE_SECURE=false`.

## Meta et génération de decks

Le meta se calcule tout seul à partir des decklists de tournoi publiées par YGOPRODeck
(catégorie *Tournament Meta Decks*) :

1. les ~300 listes les plus récentes sont récupérées (`META_SYNC_PAGES`), les artworks alternatifs résolus ;
2. elles sont regroupées en archétypes par **contenu** (Jaccard sur les cartes jouées), pas par nom ;
3. pour chaque archétype : liste type (cartes par taux d'inclusion, au nombre d'exemplaires le plus joué),
   cartes *flex*, tier selon la part du meta ;
4. les **staples** (cartes jouées par plusieurs archétypes : hand traps, board breakers) servent à compléter
   les decks générés avec ta collection.

Mise à jour au premier démarrage, puis selon `META_SYNC_CRON` (lundi 5h), ou à la main :
`pnpm meta:sync`, ou le bouton « Mettre à jour » de la page Suggestions (admin).

Le moteur (`apps/api/src/modules/meta-decks/engine/`) est fait de fonctions pures, testées sur de vraies listes.
Les decks meta peuvent aussi être importés à la main depuis un `.ydk` (`POST /api/meta-decks/import-ydk`, admin).

## Synergie et guides de deck

`apps/api/src/modules/synergy/engine/` lit le texte officiel des cartes (format PSCT de Konami) :

- **effets** : recherches, invocations depuis le Deck / la main / le cimetière, envois au cimetière,
  déclencheurs (Invocation Normale, envoi au cimetière, End Phase…), coûts « défausse cette carte » ;
- **graphe** : A → B si un effet de A peut chercher / invoquer / envoyer B dans ce deck ;
- **rôles** : starter, extender, chercheur, hand trap, interruption, destruction, pioche, boss ;
- **Extra Deck** : matériaux Fusion / Synchro / Xyz / Lien vérifiés contre le Main Deck ;
- **combos** : simulation simplifiée à partir de mains de 1–2 cartes jusqu'au boss de fin de tour.

La génération s'en sert (cartes classées par affinité avec le cœur du deck, monstres d'Extra
impossibles à invoquer retirés, note de solidité avec une composante *Synergie* et un minimum de starters),
et `POST /api/suggestions/guide` produit le guide affiché sous la composition et dans le deck builder.

**IA optionnelle** pour rédiger le guide (le guide calculé reste la base et le repli) :

```bash
AI_PROVIDER=openai            # toute API compatible OpenAI : OpenAI, Mistral, Groq, LM Studio, Ollama…
AI_BASE_URL=http://localhost:1234/v1   # ex. LM Studio (en Docker : http://host.docker.internal:1234/v1)
AI_MODEL=qwen2.5-14b-instruct
# ou : AI_PROVIDER=anthropic, AI_API_KEY=…, AI_MODEL=…
```

Les réponses sont validées (zod) et mises en cache en base (`DeckGuideCache`) par liste + modèle.
La rédaction tourne en arrière-plan (une à la fois) et le front repasse toutes les 3 s : aucun
timeout de proxy même avec un modèle local lent. Délai max côté API : `AI_TIMEOUT_MS` (3 min par défaut).

**Interactions entre cartes** : après chaque sync du catalogue, les cibles *précises* de chaque carte
(un nom / archétype cité, ou un filtre serré type « Syntoniseur LUMIÈRE de niveau 1 ») sont indexées dans
`CardEffectTarget` (quelques secondes pour tout le catalogue). La fiche d'une carte calcule ses cibles à la
volée et interroge l'index pour la question inverse (`GET /api/cards/:id/interactions`). Les effets
génériques (« 1 monstre ») ne sont pas indexés : ils visent tout le monde. Reconstruction manuelle :
`pnpm interactions:index` (automatique au démarrage si le lecteur de textes a changé).

## Qualité

```bash
pnpm typecheck
pnpm test        # règles de deck, .ydk, recherche, YGOPRODeck/Yugipedia, moteur meta (clustering, consensus, génération), synergie (lecture des effets, graphe, combos, guide)
pnpm build
```

## Roadmap

- [ ] Page admin : import de decks meta, statut des syncs
- [x] Moteur de synergie (rôles, liens entre cartes, Extra Deck invocable, combos) + guides de jeu
- [ ] Simulateur de mains de départ (probabilités d'ouvrir chaque combo)
- [ ] Quantités réelles des Structure Decks
- [ ] Recherche plein texte (`pg_trgm`) sur les effets
- [ ] Deck public partageable (lecture seule)
- [ ] Tests e2e (Playwright)
