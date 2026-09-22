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
  scoreDeck,
  type DeckScore,
  type GenerationResult,
  type Staple,
} from '../meta-decks/engine/generator';
import type { DeckTemplate } from '../meta-decks/engine/types';
import { rankBySynergy } from '../synergy/engine/affinity';
import { analyzeDeck, type DeckAnalysis } from '../synergy/engine/graph';
import type { SynCard } from '../synergy/engine/types';
import { SynergyCardsService, type FullCard } from '../synergy/synergy-cards.service';
import { computeCoverage } from './coverage';
import { t } from '../../common/i18n/locale-context';

/** Archétypes de la collection évalués pour les propositions automatiques. */
const MAX_OWNED_ARCHETYPES = 12;
/** En dessous, un archétype n'a pas assez de cartes pour porter un deck. */
const MIN_ARCHETYPE_CARDS = 6;
/** En dessous de cette couverture, inutile d'essayer de monter le deck meta avec la collection. */
const MIN_META_COVERAGE = 0.2;
const MAX_PROPOSALS = 8;
/** Decks officiels évalués pour les propositions (les mieux couverts d'abord). */
const MAX_OFFICIAL_CANDIDATES = 15;

type MetaWithCards = NonNullable<Awaited<ReturnType<DeckGeneratorService['loadMeta']>>>;
type OfficialWithCards = NonNullable<Awaited<ReturnType<DeckGeneratorService['loadOfficial']>>>;

/** Liste de référence d'une génération : la liste, son archétype, et la part déjà possédée. */
interface TemplateSource {
  template: DeckTemplate;
  archetype: string | null;
  coverage: number;
}

interface Shared {
  owned: Map<number, number>;
  staples: Staple[];
  fillers: number[];
  /** Cartes déjà chargées (texte compris) pendant cette requête */
  cards: Map<number, FullCard>;
}

interface Built {
  result: GenerationResult;
  score: DeckScore;
  analysis: DeckAnalysis;
}

/**
 * Génération automatique de decks (aperçu, rien n'est enregistré) :
 *  - depuis un deck du meta : liste type complète, ou version "avec mes cartes"
 *  - depuis un archétype de la collection
 *  - propositions : tous les decks complets et jouables que la collection permet, notés
 * Le front crée ensuite le deck via POST /decks.
 */
@Injectable()
export class DeckGeneratorService {
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
    const { result, score } = await this.buildMeta(userId, meta, mode, shared);

    const notes: string[] = [];
    if (mode === 'OWNED') notes.push(...explain(result, score));
    if (meta.listCount) notes.push(t('generator.basedOn', { count: meta.listCount }));

    return this.toDto(result, score, {
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
    const { result, score } = await this.buildOfficial(userId, deck, mode, shared);
    const name = officialName(deck);
    const notes = mode === 'OWNED' ? explain(result, score) : [];
    notes.push(t('generator.officialBasedOn', { name: deck.set.name }));

    return this.toDto(result, score, {
      name: mode === 'OWNED' ? t('generator.ownedName', { name }) : name,
      mode,
      metaDeckId: null,
      archetype: officialSource(deck, shared.owned).archetype,
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
    const notes = explain(built.result, built.score);
    if (metaVersion) notes.push(t('generator.metaVersion', { name: metaVersion.name }));

    return this.toDto(built.result, built.score, {
      name: t('generator.autoName', { name: archetype }),
      mode: 'ARCHETYPE',
      metaDeckId: null,
      archetype,
      notes,
    });
  }

  /**
   * Tous les decks complets et jouables qu'on peut monter avec la collection, du plus solide
   * au moins solide : chaque deck du meta (version "avec mes cartes") et chaque archétype
   * bien fourni de la collection est construit puis noté ; seuls les jouables sont gardés.
   */
  async playable(userId: string): Promise<PlayableDeckDto[]> {
    const shared = await this.shared(userId);
    if (!shared.owned.size) return [];

    const proposals: (PlayableDeckDto & { result: GenerationResult })[] = [];

    // 1. Decks du meta que la collection couvre au moins en partie
    const metas = await this.prisma.metaDeck.findMany({ include: { cards: true } });
    for (const meta of metas) {
      const coverage = metaCoverage(meta, shared.owned);
      if (coverage < MIN_META_COVERAGE) continue;
      const { result, score } = await this.buildMeta(userId, meta, 'OWNED', shared);
      if (!score.playable) continue;
      proposals.push({
        target: { kind: 'meta', metaDeckId: meta.id, name: meta.name },
        name: meta.name,
        archetype: meta.archetype,
        tier: meta.tier,
        score: toScoreDto(score),
        counts: result.counts,
        highlights: [],
        result,
      });
    }

    // 2. Decks officiels (structure decks, starters, decks de coffrets) les mieux couverts
    const officials = (await this.prisma.productDeck.findMany(this.officialQuery))
      .map((deck) => ({ deck, source: officialSource(deck, shared.owned) }))
      .filter((o) => o.source.coverage >= MIN_META_COVERAGE)
      .sort((a, b) => b.source.coverage - a.source.coverage)
      .slice(0, MAX_OFFICIAL_CANDIDATES);
    for (const { deck, source } of officials) {
      const built = await this.buildTemplate(userId, source, 'OWNED', shared);
      if (!built.score.playable) continue;
      const name = officialName(deck);
      proposals.push({
        target: { kind: 'official', productDeckId: deck.id, name },
        name,
        archetype: source.archetype,
        tier: null,
        score: toScoreDto(built.score),
        counts: built.result.counts,
        highlights: [],
        result: built.result,
      });
    }

    // 3. Archétypes bien fournis de la collection, sans équivalent déjà proposé
    const covered = new Set(proposals.map((p) => p.archetype?.toLowerCase()).filter(Boolean));
    for (const archetype of await this.ownedArchetypes(userId)) {
      if (covered.has(archetype.toLowerCase())) continue;
      const built = await this.buildArchetype(userId, archetype, shared);
      if (!built?.score.playable) continue;
      proposals.push({
        target: { kind: 'archetype', archetype },
        name: archetype,
        archetype,
        tier: null,
        score: toScoreDto(built.score),
        counts: built.result.counts,
        highlights: [],
        result: built.result,
      });
    }

    const best = proposals.sort((a, b) => b.score.score - a.score.score).slice(0, MAX_PROPOSALS);
    const highlights = await this.highlights(best.map((p) => p.result));
    return best.map(({ result: _result, ...p }, i) => ({ ...p, highlights: highlights[i] ?? [] }));
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

  private buildMeta(userId: string, meta: MetaWithCards, mode: GenerationMode, shared: Shared) {
    const template: DeckTemplate = {
      cards: meta.cards.filter((c) => !c.flex),
      flex: meta.cards.filter((c) => c.flex),
      mainSize: Math.max(
        40,
        meta.cards.filter((c) => c.zone === 'MAIN' && !c.flex).reduce((s, c) => s + c.quantity, 0),
      ),
    };
    return this.buildTemplate(
      userId,
      { template, archetype: meta.archetype, coverage: metaCoverage(meta, shared.owned) },
      mode,
      shared,
    );
  }

  /** Deck officiel (structure deck, starter, deck de coffret) comme liste de référence. */
  private buildOfficial(
    userId: string,
    deck: OfficialWithCards,
    mode: GenerationMode,
    shared: Shared,
  ) {
    return this.buildTemplate(userId, officialSource(deck, shared.owned), mode, shared);
  }

  /**
   * Construit un deck à partir d'une liste de référence (meta ou officielle) :
   *  - META : la liste telle quelle (on indique ce qui manque)
   *  - OWNED : uniquement les cartes possédées, complétées par l'archétype, les staples et
   *    des compléments, en gardant en priorité ce qui s'emboîte avec le cœur de la liste
   */
  private async buildTemplate(
    userId: string,
    source: TemplateSource,
    mode: GenerationMode,
    shared: Shared,
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
    const stapleIds = new Set(shared.staples.map((s) => s.cardId));

    if (mode === 'META') {
      const result = generateFromTemplate(template, {
        mode,
        cards,
        owned: shared.owned,
        staples: [],
        archetypeCards: [],
        fillers: [],
      });
      return this.evaluate(result, cards, { metaCoverage: coverage, stapleIds });
    }

    const core = pick(
      cards,
      template.cards
        .filter((c) => c.zone !== 'SIDE' && shared.owned.has(c.cardId))
        .map((c) => c.cardId),
    );
    const generate = (exclude: Set<number>) =>
      generateFromTemplate(template, {
        mode,
        cards,
        owned: shared.owned,
        staples: shared.staples,
        archetypeCards: rankBySynergy(core, without(archetypeCards, exclude), cards),
        fillers: rankBySynergy(core, without(shared.fillers, exclude), cards, 0.7),
      });
    return this.twoPass(generate, cards, { metaCoverage: coverage, stapleIds });
  }

  private async buildArchetype(
    userId: string,
    archetype: string,
    shared: Shared,
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
    const generate = (exclude: Set<number>) =>
      generateFromArchetype({
        cards,
        owned: shared.owned,
        archetypeCards: rankBySynergy(core, without(archetypeCards, exclude), cards),
        supportCards: rankBySynergy(core, without(supportCards, exclude), cards, 1.5),
        staples: shared.staples,
        fillers: rankBySynergy(core, without(shared.fillers, exclude), cards, 0.7),
      });
    return this.twoPass(generate, cards, {
      stapleIds: new Set(shared.staples.map((s) => s.cardId)),
    });
  }

  /**
   * 1re passe : on construit et on analyse. S'il reste des monstres d'Extra Deck qu'on ne
   * peut pas invoquer avec ce main (hors liste de tournoi), on les écarte et on reconstruit.
   */
  private twoPass(
    generate: (exclude: Set<number>) => GenerationResult,
    cards: Map<number, FullCard>,
    opts: { metaCoverage?: number; stapleIds: Set<number> },
  ): Built {
    const first = this.evaluate(generate(new Set()), cards, opts);
    const unreachable = new Set(
      first.analysis.extra
        .filter((x) => x.reachable === false)
        .map((x) => x.cardId)
        .filter((id) => {
          const e = first.result.entries.find((en) => en.cardId === id);
          return e && e.source !== 'CORE' && e.source !== 'FLEX';
        }),
    );
    if (!unreachable.size) return first;
    return this.evaluate(generate(unreachable), cards, opts);
  }

  private evaluate(
    result: GenerationResult,
    cards: Map<number, FullCard>,
    opts: { metaCoverage?: number; stapleIds: Set<number> },
  ): Built {
    const analysis = analyzeDeck(
      result.entries.flatMap((e) => {
        const card = cards.get(e.cardId);
        return card ? [{ card, quantity: e.quantity, zone: e.zone }] : [];
      }),
    );
    // Aucun lien lisible (textes absents ou tournures inconnues du lecteur) : on ne pénalise
    // pas le deck sur un critère qu'on ne sait pas évaluer, on garde la note classique
    const readable = analysis.edges.some((e) => e.verb !== 'MENTION');
    const score = scoreDeck(result, {
      ...opts,
      ...(readable && {
        synergy: { score: analysis.synergy.score, starterCopies: analysis.synergy.starterCopies },
      }),
    });
    return { result, score, analysis };
  }

  // ─── Sources de cartes ────────────────────────────────────────────────────

  /** Ce qui ne dépend pas de l'archétype : collection, staples et compléments possédés. */
  private async shared(userId: string): Promise<Shared> {
    const owned = await this.ownership.quantities(userId);
    if (!owned.size) return { owned, staples: [], fillers: [], cards: new Map() };
    const [staples, fillers] = await Promise.all([
      this.ownedStaples(owned),
      this.ownedFillers(userId),
    ]);
    return { owned, staples, fillers, cards: new Map() };
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
    result: GenerationResult,
    score: DeckScore,
    meta: Pick<GeneratedDeckDto, 'name' | 'mode' | 'metaDeckId' | 'archetype' | 'notes'>,
  ): Promise<GeneratedDeckDto> {
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

/** Part de la liste type (main + extra) déjà possédée. */
function metaCoverage(meta: MetaWithCards, owned: Map<number, number>): number {
  return computeCoverage(
    meta.cards
      .filter((c) => !c.flex)
      .map((c) => ({ cardId: c.cardId, zone: c.zone, quantity: c.quantity, unitPrice: null })),
    owned,
  ).coverage;
}

/** Nom affiché d'un deck officiel : le produit, et le deck quand le produit en contient plusieurs. */
const officialName = (deck: OfficialWithCards) =>
  deck.name ? `${deck.set.name} — ${deck.name}` : deck.set.name;

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
  };
}

const without = (ids: number[], exclude: Set<number>) =>
  exclude.size ? ids.filter((id) => !exclude.has(id)) : ids;
const pick = (cards: Map<number, SynCard>, ids: number[]) =>
  ids.flatMap((id) => (cards.has(id) ? [cards.get(id)!] : []));

const round2 = (x: number) => Math.round(x * 100) / 100;

function toScoreDto(s: DeckScore) {
  return {
    ...s,
    engineShare: round2(s.engineShare),
    consistency: round2(s.consistency),
    fillerShare: round2(s.fillerShare),
    metaCoverage: s.metaCoverage === null ? null : round2(s.metaCoverage),
    synergy: s.synergy === null ? null : round2(s.synergy),
  };
}

/** Explications lisibles de la composition d'un deck "avec mes cartes". */
function explain(result: GenerationResult, score: DeckScore): string[] {
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
  return notes;
}
