import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CardSummaryDto,
  GeneratedDeckDto,
  GenerationMode,
  PlayableDeckDto,
} from '@ygo/shared';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../collection/ownership.service';
import {
  generateFromArchetype,
  generateFromTemplate,
  type DeckScore,
  type EntrySource,
  type GenerationResult,
  type ScoreOptions,
  type Staple,
} from '../meta-decks/engine/generator';
import type { DeckTemplate } from '../meta-decks/engine/types';
import { rankBySynergy } from '../synergy/engine/affinity';
import type { SynCard } from '../synergy/engine/types';
import { SynergyCardsService, type FullCard } from '../synergy/synergy-cards.service';
import { computeCoverage } from './coverage';
import {
  buildPool,
  enginesOf,
  evaluateDeck,
  legalityOf,
  optimizeDeck,
  overlap,
  type OptimizeResult,
} from './deck-optimizer';
import { currentLocale, t } from '../../common/i18n/locale-context';

/** Archétypes de la collection évalués pour les propositions automatiques. */
const MAX_OWNED_ARCHETYPES = 12;
/** En dessous, un archétype n'a pas assez de cartes pour porter un deck. */
const MIN_ARCHETYPE_CARDS = 6;
/** En dessous de cette couverture, inutile d'essayer de monter le deck meta avec la collection. */
const MIN_META_COVERAGE = 0.2;
const MAX_PROPOSALS = 8;
/** Decks officiels évalués pour les propositions (les mieux couverts d'abord). */
const MAX_OFFICIAL_CANDIDATES = 15;
/**
 * Premiers jets optimisés pour la page de propositions : les mieux notés d'abord. Les autres
 * ne seraient de toute façon pas dans le haut du classement, et chaque optimisation coûte
 * quelques centaines d'évaluations.
 */
const MAX_OPTIMIZED = 10;
/** Deux propositions qui partagent plus de cette part de leur main sont le même deck. */
const SAME_DECK = 0.6;
/** Une proposition se recalcule quand la collection, le meta ou la banlist bougent ; sinon on la garde. */
const PLAYABLE_TTL_MS = 10 * 60_000;

type MetaWithCards = NonNullable<Awaited<ReturnType<DeckGeneratorService['loadMeta']>>>;
type OfficialWithCards = NonNullable<Awaited<ReturnType<DeckGeneratorService['loadOfficial']>>>;

/** Liste de référence d'une génération : la liste, son archétype, et la part déjà possédée. */
interface TemplateSource {
  template: DeckTemplate;
  archetype: string | null;
  coverage: number;
  /** Liste de tournoi : son cœur ne se retire pas (c'est ce qui en fait CE deck) */
  lockCore: boolean;
}

interface Shared {
  owned: Map<number, number>;
  /** Staples du meta possédés, du plus joué au moins joué */
  staples: Staple[];
  /** Compléments génériques possédés, des meilleurs aux moins bons */
  fillers: number[];
  /** Tous les staples du meta (possédés ou non) : c'est ce qui les reconnaît dans un deck */
  stapleIds: Set<number>;
  /** Taux de jeu en tournoi de chaque carte */
  metaPlay: Map<number, number>;
  /** Popularité (vues YGOPRODeck) des cartes possédées */
  popularity: Map<number, number>;
  /** Cartes déjà chargées (texte compris) pendant cette requête */
  cards: Map<number, FullCard>;
  /** Toute la collection, chargée à la première recherche de second moteur */
  collection?: FullCard[];
}

interface Built extends OptimizeResult {
  engines: string[];
  /** Cartes possédées écartées par la légalité (interdites, hors TCG) ou bridées (limitées) */
  legality: { excluded: number; capped: number };
}

/**
 * Génération automatique de decks (aperçu, rien n'est enregistré) :
 *  - depuis un deck du meta : liste type complète, ou version "avec mes cartes"
 *  - depuis un archétype de la collection
 *  - propositions : les decks les plus solides que la collection permet, notés
 * Le front crée ensuite le deck via POST /decks.
 *
 * Toute version "avec mes cartes" suit le même chemin : un premier jet gourmand (le
 * générateur), puis l'optimiseur, qui échange des cartes tant que la note de solidité monte —
 * y compris avec des cartes d'autres archétypes reliées au cœur, d'où les decks hybrides.
 * Le chemin étant déterministe, l'aperçu d'une proposition retombe toujours sur la même liste.
 */
@Injectable()
export class DeckGeneratorService {
  private readonly playableCache = new Map<
    string,
    { key: string; at: number; decks: PlayableDeckDto[] }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly synCards: SynergyCardsService,
  ) {}

  async fromMeta(
    userId: string,
    metaDeckId: string,
    mode: GenerationMode,
  ): Promise<GeneratedDeckDto> {
    const meta = await this.loadMeta(metaDeckId);
    if (!meta) throw new NotFoundException(t('errors.metaDeckNotFound'));
    const shared = await this.shared(userId);
    const built = await this.buildTemplate(userId, metaSource(meta, shared.owned), mode, shared);

    const notes: string[] = [];
    if (mode === 'OWNED') notes.push(...explain(built));
    if (meta.listCount) notes.push(t('generator.basedOn', { count: meta.listCount }));

    return this.toDto(built, {
      name: mode === 'OWNED' ? t('generator.ownedName', { name: meta.name }) : meta.name,
      mode,
      metaDeckId: meta.id,
      archetype: meta.archetype,
      notes,
    });
  }

  /** Deck officiel d'un produit : liste complète, ou version « avec mes cartes ». */
  async fromOfficial(
    userId: string,
    productDeckId: string,
    mode: GenerationMode,
  ): Promise<GeneratedDeckDto> {
    const deck = await this.loadOfficial(productDeckId);
    if (!deck) throw new NotFoundException(t('errors.officialDeckNotFound'));
    const shared = await this.shared(userId);
    const source = officialSource(deck, shared.owned);
    const built = await this.buildTemplate(userId, source, mode, shared);
    const name = officialName(deck);
    const notes = mode === 'OWNED' ? explain(built) : [];
    notes.push(t('generator.officialBasedOn', { name: deck.set.name }));

    return this.toDto(built, {
      name: mode === 'OWNED' ? t('generator.ownedName', { name }) : name,
      mode,
      metaDeckId: null,
      archetype: source.archetype,
      notes,
    });
  }

  async fromArchetype(userId: string, archetype: string): Promise<GeneratedDeckDto> {
    const shared = await this.shared(userId);
    const built = await this.buildArchetype(userId, archetype, shared);
    if (!built) throw new NotFoundException(t('errors.archetypeNotOwned', { archetype }));

    const metaVersion = await this.prisma.metaDeck.findFirst({
      where: { archetype: { equals: archetype, mode: 'insensitive' } },
      orderBy: { listCount: 'desc' },
      select: { name: true },
    });
    const notes = explain(built);
    if (metaVersion) notes.push(t('generator.metaVersion', { name: metaVersion.name }));

    return this.toDto(built, {
      name: t('generator.autoName', { name: deckName(archetype, built.engines) }),
      mode: 'ARCHETYPE',
      metaDeckId: null,
      archetype,
      notes,
    });
  }

  /**
   * Les decks les plus solides qu'on peut monter avec la collection, du plus solide au moins
   * solide : chaque deck du meta (version "avec mes cartes"), chaque deck officiel bien
   * couvert et chaque archétype bien fourni donne un premier jet ; les meilleurs sont
   * optimisés, puis on écarte les doublons et tout ce qui n'est pas jouable.
   */
  async playable(userId: string): Promise<PlayableDeckDto[]> {
    const key = await this.playableKey(userId);
    // Par langue aussi : les noms des cartes phares sont traduits
    const slot = `${userId}:${currentLocale()}`;
    const cached = this.playableCache.get(slot);
    if (cached && cached.key === key && Date.now() - cached.at < PLAYABLE_TTL_MS) {
      return cached.decks;
    }
    const decks = await this.computePlayable(userId);
    const now = Date.now();
    // Les entrées périmées partent au passage : le cache ne grossit pas avec les comptes inactifs
    for (const [k, v] of this.playableCache) {
      if (now - v.at >= PLAYABLE_TTL_MS) this.playableCache.delete(k);
    }
    this.playableCache.set(slot, { key, at: now, decks });
    return decks;
  }

  private async computePlayable(userId: string): Promise<PlayableDeckDto[]> {
    const shared = await this.shared(userId);
    if (!shared.owned.size) return [];

    type Seed = {
      target: PlayableDeckDto['target'];
      name: string;
      archetype: string | null;
      tier: number | null;
      /** Premier jet seulement (rapide) ; `optimize` le pousse au maximum */
      draft: () => Promise<Built | null>;
      optimize: () => Promise<Built | null>;
      draftScore?: number;
    };
    const seeds: Seed[] = [];

    // 1. Decks du meta que la collection couvre au moins en partie
    for (const meta of await this.prisma.metaDeck.findMany({ include: { cards: true } })) {
      const source = metaSource(meta, shared.owned);
      if (source.coverage < MIN_META_COVERAGE) continue;
      seeds.push({
        target: { kind: 'meta', metaDeckId: meta.id, name: meta.name },
        name: meta.name,
        archetype: meta.archetype,
        tier: meta.tier,
        draft: () => this.buildTemplate(userId, source, 'OWNED', shared, { optimize: false }),
        optimize: () => this.buildTemplate(userId, source, 'OWNED', shared),
      });
    }

    // 2. Decks officiels (structure decks, starters, decks de coffrets) les mieux couverts
    const officials = (await this.prisma.productDeck.findMany(this.officialQuery))
      .map((deck) => ({ deck, source: officialSource(deck, shared.owned) }))
      .filter((o) => o.source.coverage >= MIN_META_COVERAGE)
      .sort((a, b) => b.source.coverage - a.source.coverage)
      .slice(0, MAX_OFFICIAL_CANDIDATES);
    for (const { deck, source } of officials) {
      const name = officialName(deck);
      seeds.push({
        target: { kind: 'official', productDeckId: deck.id, name },
        name,
        archetype: source.archetype,
        tier: null,
        draft: () => this.buildTemplate(userId, source, 'OWNED', shared, { optimize: false }),
        optimize: () => this.buildTemplate(userId, source, 'OWNED', shared),
      });
    }

    // 3. Archétypes bien fournis de la collection : le terrain des decks maison et hybrides
    for (const archetype of await this.ownedArchetypes(userId)) {
      seeds.push({
        target: { kind: 'archetype', archetype },
        name: archetype,
        archetype,
        tier: null,
        draft: () => this.buildArchetype(userId, archetype, shared, { optimize: false }),
        optimize: () => this.buildArchetype(userId, archetype, shared),
      });
    }

    // Premiers jets : on n'optimise que les plus prometteurs, un par archétype
    for (const seed of seeds) seed.draftScore = (await seed.draft())?.score.raw ?? -1;
    const seen = new Set<string>();
    const chosen = seeds
      .filter((s) => (s.draftScore ?? -1) >= 0)
      .sort((a, b) => b.draftScore! - a.draftScore!)
      .filter((s) => {
        const k =
          s.target.kind === 'archetype'
            ? `a:${s.archetype?.toLowerCase()}`
            : `${s.target.kind}:${s.name}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, MAX_OPTIMIZED);

    const proposals: (PlayableDeckDto & { built: Built })[] = [];
    for (const seed of chosen) {
      const built = await seed.optimize();
      if (!built?.score.playable) continue;
      const hybrid = seed.target.kind === 'archetype' && built.engines.length >= 2;
      proposals.push({
        target: seed.target,
        name: seed.target.kind === 'archetype' ? deckName(seed.name, built.engines) : seed.name,
        archetype: seed.archetype,
        tier: seed.tier,
        engines: built.engines,
        hybrid,
        score: toScoreDto(built.score),
        counts: built.result.counts,
        highlights: [],
        built,
      });
    }

    // Deux chemins mènent souvent au même deck (le structure deck et l'archétype qu'il contient,
    // ou Branded × Despia et Despia × Branded) : on ne garde que le mieux noté
    const engineKey = (p: PlayableDeckDto) =>
      p.target.kind === 'archetype' && p.engines.length ? [...p.engines].sort().join('+') : null;
    const same = (a: PlayableDeckDto & { built: Built }, b: PlayableDeckDto & { built: Built }) =>
      overlap(a.built.result, b.built.result) >= SAME_DECK ||
      (engineKey(a) !== null && engineKey(a) === engineKey(b));
    const best: (PlayableDeckDto & { built: Built })[] = [];
    for (const p of proposals.sort((a, b) => b.built.score.raw - a.built.score.raw)) {
      if (best.some((q) => same(q, p))) continue;
      best.push(p);
      if (best.length >= MAX_PROPOSALS) break;
    }
    const highlights = await this.highlights(best.map((p) => p.built.result));
    return best.map(({ built: _built, ...p }, i) => ({ ...p, highlights: highlights[i] ?? [] }));
  }

  /**
   * Ce qui change une proposition : la collection, le meta, la banlist. Une ligne d'agrégats,
   * lue à chaque appel — c'est elle qui évite de tout recalculer quand rien n'a bougé.
   */
  private async playableKey(userId: string): Promise<string> {
    const [row] = await this.prisma.$queryRaw<
      { items: number; copies: number; changed: Date | null; meta: Date | null; ban: Date | null }[]
    >`
      SELECT (SELECT COUNT(*)::int FROM "CollectionItem" WHERE "userId" = ${userId}) AS "items",
             (SELECT COALESCE(SUM(quantity), 0)::int FROM "CollectionItem" WHERE "userId" = ${userId}) AS "copies",
             (SELECT MAX("updatedAt") FROM "CollectionItem" WHERE "userId" = ${userId}) AS "changed",
             (SELECT MAX("updatedAt") FROM "MetaDeck") AS "meta",
             (SELECT MAX("lastSyncAt") FROM "SyncState") AS "ban"`;
    return JSON.stringify(row ?? null);
  }

  // ─── Construction ─────────────────────────────────────────────────────────

  loadMeta(id: string) {
    return this.prisma.metaDeck.findUnique({ where: { id }, include: { cards: true } });
  }

  private officialQuery = {
    include: {
      set: { select: { name: true } },
      cards: { include: { card: { select: { isExtraDeck: true, archetype: true } } } },
    },
  } as const;

  loadOfficial(id: string) {
    return this.prisma.productDeck.findUnique({ where: { id }, ...this.officialQuery });
  }

  /**
   * Construit un deck à partir d'une liste de référence (meta ou officielle) :
   *  - META : la liste telle quelle (on indique ce qui manque)
   *  - OWNED : uniquement les cartes possédées — premier jet gourmand (cœur, archétype,
   *    staples, compléments), puis optimisation avec tout ce qui s'emboîte avec ce cœur
   */
  private async buildTemplate(
    userId: string,
    source: TemplateSource,
    mode: GenerationMode,
    shared: Shared,
    opts: { optimize?: boolean } = {},
  ): Promise<Built> {
    const { template, archetype, coverage } = source;
    const archetypeCards =
      mode === 'OWNED' && archetype ? await this.ownedArchetypeCards(userId, archetype) : [];
    const templateIds = [...template.cards, ...template.flex].map((c) => c.cardId);
    const cards = await this.cardInfo(shared, [
      ...templateIds,
      ...(mode === 'OWNED'
        ? [...shared.staples.map((s) => s.cardId), ...archetypeCards, ...shared.fillers]
        : []),
    ]);
    const scoring = this.scoring(shared, coverage);

    if (mode === 'META') {
      const result = generateFromTemplate(template, {
        mode,
        cards,
        owned: shared.owned,
        staples: [],
        archetypeCards: [],
        fillers: [],
      });
      const ev = evaluateDeck(result, cards, scoring);
      return { ...ev, baseline: ev.score, swaps: 0, evaluations: 1, engines: [], legality: none };
    }

    const core = pick(
      cards,
      template.cards
        .filter((c) => c.zone !== 'SIDE' && shared.owned.has(c.cardId))
        .map((c) => c.cardId),
    );
    const seed = generateFromTemplate(template, {
      mode,
      cards,
      owned: shared.owned,
      staples: shared.staples,
      archetypeCards: rankBySynergy(core, archetypeCards, cards),
      fillers: rankBySynergy(core, shared.fillers, cards, 0.7),
    });
    const sources = new Map<number, { source: EntrySource; inclusion: number | null }>();
    for (const c of template.cards)
      sources.set(c.cardId, { source: 'CORE', inclusion: c.inclusion });
    for (const c of template.flex) {
      if (!sources.has(c.cardId)) sources.set(c.cardId, { source: 'FLEX', inclusion: c.inclusion });
    }
    const support = archetype ? await this.ownedSupportCards(userId, archetype) : [];
    for (const id of archetypeCards)
      if (!sources.has(id)) sources.set(id, { source: 'ARCHETYPE', inclusion: null });
    for (const id of support)
      if (!sources.has(id)) sources.set(id, { source: 'SUPPORT', inclusion: null });

    const locked = source.lockCore
      ? new Set(template.cards.filter((c) => shared.owned.has(c.cardId)).map((c) => c.cardId))
      : undefined;
    return this.optimize(shared, {
      seed,
      sources,
      archetype,
      scoring,
      locked,
      optimize: opts.optimize,
    });
  }

  private async buildArchetype(
    userId: string,
    archetype: string,
    shared: Shared,
    opts: { optimize?: boolean } = {},
  ): Promise<Built | null> {
    const [archetypeCards, supportCards] = await Promise.all([
      this.ownedArchetypeCards(userId, archetype),
      this.ownedSupportCards(userId, archetype),
    ]);
    if (!archetypeCards.length) return null;
    const cards = await this.cardInfo(shared, [
      ...archetypeCards,
      ...supportCards,
      ...shared.staples.map((s) => s.cardId),
      ...shared.fillers,
    ]);
    // Cœur = les cartes de l'archétype elles-mêmes : on fait remonter celles qui sont reliées
    // aux autres (chercheurs, invocateurs…) et les supports qui les appellent vraiment
    const core = pick(cards, archetypeCards);
    const seed = generateFromArchetype({
      cards,
      owned: shared.owned,
      archetypeCards: rankBySynergy(core, archetypeCards, cards),
      supportCards: rankBySynergy(core, supportCards, cards, 1.5),
      staples: shared.staples,
      fillers: rankBySynergy(core, shared.fillers, cards, 0.7),
    });
    const sources = new Map<number, { source: EntrySource; inclusion: number | null }>();
    for (const id of archetypeCards) sources.set(id, { source: 'ARCHETYPE', inclusion: null });
    for (const id of supportCards)
      if (!sources.has(id)) sources.set(id, { source: 'SUPPORT', inclusion: null });
    return this.optimize(shared, {
      seed,
      sources,
      archetype,
      scoring: this.scoring(shared),
      optimize: opts.optimize,
    });
  }

  /**
   * Réserve de l'optimiseur (`buildPool`), puis optimisation. Sans optimisation demandée, la
   * réserve se limite au premier jet : c'est la version rapide qui sert à trier les pistes.
   */
  private async optimize(
    shared: Shared,
    input: {
      seed: GenerationResult;
      sources: Map<number, { source: EntrySource; inclusion: number | null }>;
      archetype: string | null;
      scoring: Omit<ScoreOptions, 'synergy'>;
      locked?: Set<number>;
      optimize?: boolean;
    },
  ): Promise<Built> {
    const full = input.optimize !== false;
    const collection = full ? await this.collection(shared) : undefined;
    const pool = buildPool({
      seed: input.seed,
      sources: input.sources,
      archetype: input.archetype,
      owned: shared.owned,
      cards: shared.cards,
      staples: shared.staples,
      fillers: shared.fillers,
      metaPlay: shared.metaPlay,
      popularity: shared.popularity,
      collection,
    });
    const cards = await this.cardInfo(
      shared,
      pool.map((p) => p.cardId),
    );
    const optimized = optimizeDeck({
      cards,
      pool,
      seed: input.seed,
      scoring: input.scoring,
      locked: input.locked,
      budget: full ? undefined : 0,
    });
    return {
      ...optimized,
      engines: enginesOf(optimized.result, cards),
      legality: legalityOf(pool, cards),
    };
  }

  private scoring(shared: Shared, metaCoverage?: number): Omit<ScoreOptions, 'synergy'> {
    return {
      stapleIds: shared.stapleIds,
      ...(metaCoverage !== undefined && { metaCoverage }),
      ...(shared.metaPlay.size && { metaPlay: shared.metaPlay }),
    };
  }

  // ─── Sources de cartes ────────────────────────────────────────────────────

  /** Ce qui ne dépend pas de l'archétype : collection, staples, compléments, taux de jeu. */
  private async shared(userId: string): Promise<Shared> {
    const owned = await this.ownership.quantities(userId);
    const stats = await this.prisma.cardMetaStat.findMany({
      select: { cardId: true, deckShare: true, isStaple: true },
    });
    const stapleIds = new Set(stats.filter((s) => s.isStaple).map((s) => s.cardId));
    const metaPlay = new Map(stats.map((s) => [s.cardId, s.deckShare]));
    const empty = { staples: [], fillers: [], popularity: new Map(), cards: new Map() };
    if (!owned.size) return { owned, stapleIds, metaPlay, ...empty };
    const [staples, fillers, popular] = await Promise.all([
      this.ownedStaples(owned),
      this.ownedFillers(userId),
      this.prisma.card.findMany({
        where: { id: { in: [...owned.keys()] }, popularity: { not: null } },
        select: { id: true, popularity: true },
      }),
    ]);
    const popularity = new Map(popular.map((c) => [c.id, c.popularity ?? 0]));
    return { owned, staples, fillers, stapleIds, metaPlay, popularity, cards: new Map() };
  }

  /** Staples du meta possédés, du plus joué au moins joué. */
  private ownedStaples(owned: Map<number, number>): Promise<Staple[]> {
    return this.prisma.cardMetaStat.findMany({
      where: { isStaple: true, cardId: { in: [...owned.keys()] } },
      orderBy: { deckShare: 'desc' },
      select: { cardId: true, avgCopies: true },
    });
  }

  /**
   * Compléments : cartes génériques possédées (sans archétype, donc utilisables partout),
   * les plus jouées en tournoi puis les plus populaires d'abord.
   */
  private async ownedFillers(userId: string): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c.id FROM "Card" c
      LEFT JOIN "CardMetaStat" m ON m."cardId" = c.id
      WHERE c.archetype IS NULL
        AND c.category IN ('MONSTER', 'SPELL', 'TRAP')
        AND EXISTS (SELECT 1 FROM "CollectionItem" ci WHERE ci."cardId" = c.id AND ci."userId" = ${userId})
      ORDER BY m."deckShare" DESC NULLS LAST, c.popularity DESC NULLS LAST, c.name
      LIMIT 200`;
    return rows.map((r) => r.id);
  }

  /** Cartes possédées de l'archétype, les plus jouées en tournoi d'abord, monstres avant magies/pièges. */
  private async ownedArchetypeCards(userId: string, archetype: string): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c.id FROM "Card" c
      LEFT JOIN "CardMetaStat" m ON m."cardId" = c.id
      WHERE lower(c.archetype) = lower(${archetype})
        AND EXISTS (SELECT 1 FROM "CollectionItem" ci WHERE ci."cardId" = c.id AND ci."userId" = ${userId})
      ORDER BY m."deckShare" DESC NULLS LAST,
               CASE c.category WHEN 'MONSTER' THEN 0 WHEN 'SPELL' THEN 1 ELSE 2 END,
               c.popularity DESC NULLS LAST,
               c.name`;
    return rows.map((r) => r.id);
  }

  /** Cartes possédées hors archétype dont le texte le cite ("… a "Blue-Eyes" monster …"). */
  private async ownedSupportCards(userId: string, archetype: string): Promise<number[]> {
    const pattern = `%"${archetype}"%`;
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c.id FROM "Card" c
      LEFT JOIN "CardMetaStat" m ON m."cardId" = c.id
      WHERE (c.archetype IS NULL OR lower(c.archetype) <> lower(${archetype}))
        AND c."desc" ILIKE ${pattern}
        AND EXISTS (SELECT 1 FROM "CollectionItem" ci WHERE ci."cardId" = c.id AND ci."userId" = ${userId})
      ORDER BY m."deckShare" DESC NULLS LAST, c.popularity DESC NULLS LAST, c.name
      LIMIT 30`;
    return rows.map((r) => r.id);
  }

  /** Archétypes les mieux fournis de la collection (en cartes différentes). */
  private async ownedArchetypes(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ archetype: string }[]>`
      SELECT c.archetype FROM "CollectionItem" ci
      JOIN "Card" c ON c.id = ci."cardId"
      WHERE ci."userId" = ${userId} AND c.archetype IS NOT NULL
      GROUP BY c.archetype
      HAVING COUNT(DISTINCT c.id) >= ${MIN_ARCHETYPE_CARDS}
      ORDER BY COUNT(DISTINCT c.id) DESC, SUM(ci.quantity) DESC
      LIMIT ${MAX_OWNED_ARCHETYPES}`;
    return rows.map((r) => r.archetype);
  }

  /** Infos de construction + texte des cartes, chargées une seule fois par requête. */
  private async cardInfo(shared: Shared, ids: number[]): Promise<Map<number, FullCard>> {
    const missing = [...new Set(ids)].filter((id) => !shared.cards.has(id));
    for (const c of await this.synCards.load(missing)) shared.cards.set(c.id, c);
    return shared.cards;
  }

  /** Toute la collection avec ses textes : c'est là qu'on cherche les seconds moteurs. */
  private async collection(shared: Shared): Promise<FullCard[]> {
    if (!shared.collection) {
      const cards = await this.cardInfo(shared, [...shared.owned.keys()]);
      shared.collection = [...shared.owned.keys()].flatMap((id) =>
        cards.has(id) ? [cards.get(id)!] : [],
      );
    }
    return shared.collection;
  }

  /** 4 cartes phares par deck : les cartes moteur du main, les plus jouées d'abord. */
  private async highlights(results: GenerationResult[]): Promise<CardSummaryDto[][]> {
    const picks = results.map((r) =>
      r.entries
        .filter((e) => e.zone === 'MAIN' && e.source !== 'FILLER' && e.source !== 'STAPLE')
        .sort((a, b) => (b.inclusion ?? 0) - (a.inclusion ?? 0) || b.quantity - a.quantity)
        .slice(0, 4)
        .map((e) => e.cardId),
    );
    const cards = await this.prisma.card.findMany({
      where: { id: { in: [...new Set(picks.flat())] } },
      select: cardSummarySelect,
    });
    const byId = new Map(cards.map((c) => [c.id, toCardSummary(c)]));
    return picks.map((ids) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
  }

  private async toDto(
    built: Built,
    meta: Pick<GeneratedDeckDto, 'name' | 'mode' | 'metaDeckId' | 'archetype' | 'notes'>,
  ): Promise<GeneratedDeckDto> {
    const { result, score } = built;
    const cards = await this.prisma.card.findMany({
      where: { id: { in: result.entries.map((e) => e.cardId) } },
      select: cardSummarySelect,
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const entries = result.entries.flatMap((e) => {
      const card = byId.get(e.cardId);
      return card ? [{ ...e, card: toCardSummary(card, e.owned) }] : [];
    });
    const missingCost = entries.reduce(
      (s, e) => s + (e.quantity - e.owned) * (toNumber(byId.get(e.cardId)!.priceCardmarket) ?? 0),
      0,
    );
    return {
      ...meta,
      engines: built.engines,
      cards: entries.map(({ card, zone, quantity, owned, source, inclusion }) => ({
        card,
        zone,
        quantity,
        owned,
        source,
        inclusion,
      })),
      counts: result.counts,
      missingCopies: result.missingCopies,
      missingCost: Math.round(missingCost * 100) / 100,
      complete: result.complete,
      score: toScoreDto(score),
    };
  }
}

const none = { excluded: 0, capped: 0 };

/** Liste de tournoi comme liste de référence. Son cœur est verrouillé : c'est CE deck. */
function metaSource(meta: MetaWithCards, owned: Map<number, number>): TemplateSource {
  const template: DeckTemplate = {
    cards: meta.cards.filter((c) => !c.flex),
    flex: meta.cards.filter((c) => c.flex),
    mainSize: Math.max(
      40,
      meta.cards.filter((c) => c.zone === 'MAIN' && !c.flex).reduce((s, c) => s + c.quantity, 0),
    ),
  };
  return {
    template,
    archetype: meta.archetype,
    coverage: computeCoverage(
      template.cards.map((c) => ({
        cardId: c.cardId,
        zone: c.zone,
        quantity: c.quantity,
        unitPrice: null,
      })),
      owned,
    ).coverage,
    lockCore: true,
  };
}

/** Nom affiché d'un deck officiel : le produit, et le deck quand le produit en contient plusieurs. */
const officialName = (deck: OfficialWithCards) =>
  deck.name ? `${deck.set.name} — ${deck.name}` : deck.set.name;

/**
 * Deck officiel comme liste de référence. Rien n'est verrouillé : un structure deck est un
 * point de départ, et le renforcer avec sa collection est exactement ce que font les joueurs.
 */
function officialSource(deck: OfficialWithCards, owned: Map<number, number>): TemplateSource {
  const cards = deck.cards.map((c) => ({
    cardId: c.cardId,
    zone: c.card.isExtraDeck ? ('EXTRA' as const) : ('MAIN' as const),
    quantity: c.quantity,
    // Pas de taux de jeu pour un deck officiel : on priorise les cartes en plusieurs exemplaires
    inclusion: Math.min(1, c.quantity / 3),
  }));
  // Archétype dominant (au moins 5 exemplaires) : sert à compléter avec les cartes possédées
  const copies = new Map<string, number>();
  for (const c of deck.cards) {
    if (c.card.archetype)
      copies.set(c.card.archetype, (copies.get(c.card.archetype) ?? 0) + c.quantity);
  }
  const [archetype, n] = [...copies].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return {
    template: {
      cards,
      flex: [],
      mainSize: Math.max(
        40,
        cards.filter((c) => c.zone === 'MAIN').reduce((s, c) => s + c.quantity, 0),
      ),
    },
    archetype: n >= 5 ? archetype : null,
    coverage: computeCoverage(
      cards.map((c) => ({ ...c, unitPrice: null })),
      owned,
    ).coverage,
    lockCore: false,
  };
}

/** « Blue-Eyes », ou « Blue-Eyes × Dragonmaid » quand un second moteur pèse dans le deck. */
function deckName(archetype: string, engines: string[]): string {
  const others = engines.filter((e) => e.toLowerCase() !== archetype.toLowerCase());
  return [archetype, ...others.slice(0, 1)].join(' × ');
}

const pick = (cards: Map<number, SynCard>, ids: number[]) =>
  ids.flatMap((id) => (cards.has(id) ? [cards.get(id)!] : []));

const round2 = (x: number) => Math.round(x * 100) / 100;

function toScoreDto({ raw: _raw, ...s }: DeckScore) {
  return {
    ...s,
    engineShare: round2(s.engineShare),
    consistency: round2(s.consistency),
    fillerShare: round2(s.fillerShare),
    metaCoverage: s.metaCoverage === null ? null : round2(s.metaCoverage),
    synergy: s.synergy === null ? null : round2(s.synergy),
    opening: s.opening === null ? null : round2(s.opening),
  };
}

/** Explications lisibles de la composition d'un deck "avec mes cartes". */
function explain(built: Built): string[] {
  const { result, score, baseline, swaps, engines, legality } = built;
  const main = result.counts.MAIN;
  const notes = [
    t('generator.composition', {
      engine: Math.round(score.engineShare * main),
      staples: score.staples,
      fillers: Math.round(score.fillerShare * main),
    }),
  ];
  if (!result.complete) notes.push(t('generator.incomplete', { count: 40 - main }));
  else if (!score.playable) notes.push(t('generator.fragile'));
  if (score.opening !== null) {
    notes.push(
      t('generator.opening', {
        percent: Math.round(score.opening * 100),
        starters: score.starters ?? 0,
        interaction: score.interaction ?? 0,
      }),
    );
  }
  if (engines.length >= 2) notes.push(t('generator.engines', { names: engines.join(' + ') }));
  if (swaps > 0 && score.score > baseline.score) {
    notes.push(t('generator.optimized', { count: swaps, from: baseline.score, to: score.score }));
  }
  if (legality.excluded) notes.push(t('generator.excluded', { count: legality.excluded }));
  if (legality.capped) notes.push(t('generator.capped', { count: legality.capped }));
  return notes;
}
