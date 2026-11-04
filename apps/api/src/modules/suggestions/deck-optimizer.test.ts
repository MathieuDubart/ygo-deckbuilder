import { describe, expect, it } from 'vitest';
import type { GeneratedEntry, GenerationResult } from '../meta-decks/engine/generator';
import {
  ABYSS,
  ALTERNATIVE,
  ASH,
  BEWD,
  DARK_RULER,
  DICTATOR,
  EVENLY_MATCHED,
  GAMECIEL,
  LIGHTNING_STORM,
  LINKURIBOH,
  MAJESTY,
  POLYMERIZATION,
  RAIGEKI,
  RANK7,
  SAGE,
  SPIRIT_DRAGON,
  TITANIC,
  TRADE_IN,
  TWIN_BURST,
  ULTIMATE,
  ULTIMATE_SPIRIT,
  VANITYS_EMPTINESS,
  WHITE_STONE_ANCIENTS,
  WHITE_STONE_LEGEND,
} from '../synergy/engine/fixtures';
import { checkExtra, type DeckEntry } from '../synergy/engine/graph';
import type { SynCard } from '../synergy/engine/types';
import {
  buildPool,
  enginesOf,
  evaluateDeck,
  legalityOf,
  optimizeDeck,
  overlap,
  type OptCard,
  type PoolCard,
} from './deck-optimizer';

/**
 * Banc de l'optimiseur : le vrai moteur Blue-Eyes (textes officiels des fixtures), des
 * hand traps et casse-terrains réels, et des cartes inventées pour le reste — compléments
 * sans effet, une carte interdite, une carte qui n'existe qu'en OCG.
 */
const opt = (c: SynCard, over: Partial<OptCard> = {}): OptCard => ({ ...c, banTcg: null, ...over });

const vanilla = (id: number): OptCard =>
  opt({
    id,
    name: `Plain Soldier ${id}`,
    desc: 'An ordinary soldier.',
    type: 'Normal Monster',
    frameType: 'normal',
    category: 'MONSTER',
    race: 'Warrior',
    attribute: 'EARTH',
    level: 4,
    linkVal: null,
    archetype: null,
    isExtraDeck: false,
  });

const FORBIDDEN = opt(
  {
    ...vanilla(7001),
    name: 'Forbidden Wonder',
    desc: 'Draw 2 cards.',
    type: 'Spell Card',
    frameType: 'spell',
    category: 'SPELL',
    race: 'Normal',
    level: null,
  },
  { banTcg: 'Forbidden' },
);
const OCG_ONLY = opt({ ...ASH, id: 7002, name: 'Faraway Hand Trap' }, { tcgLegal: false });
const STORM = opt(LIGHTNING_STORM, { banTcg: 'Limited' });

const ENGINE = [
  BEWD,
  SAGE,
  WHITE_STONE_ANCIENTS,
  WHITE_STONE_LEGEND,
  ALTERNATIVE,
  DICTATOR,
  ABYSS,
  MAJESTY,
  TRADE_IN,
  POLYMERIZATION,
];
const EXTRAS = [SPIRIT_DRAGON, ULTIMATE_SPIRIT, TWIN_BURST, ULTIMATE, TITANIC, LINKURIBOH, RANK7];
const FILLERS = Array.from({ length: 14 }, (_, i) => vanilla(8000 + i));

const all: OptCard[] = [
  ...ENGINE.map((c) => opt(c)),
  ...EXTRAS.map((c) => opt(c)),
  opt(ASH),
  opt(RAIGEKI),
  opt(EVENLY_MATCHED),
  opt(DARK_RULER),
  opt(GAMECIEL),
  opt(VANITYS_EMPTINESS),
  STORM,
  FORBIDDEN,
  OCG_ONLY,
  ...FILLERS,
];
const cards = new Map(all.map((c) => [c.id, c]));
const owned = new Map(all.map((c) => [c.id, 3]));
// Plus d'interaction qu'un main n'en prend : le reste doit finir au Side
const INTERACTION = [
  ASH,
  RAIGEKI,
  EVENLY_MATCHED,
  DARK_RULER,
  GAMECIEL,
  VANITYS_EMPTINESS,
  STORM,
  FORBIDDEN,
  OCG_ONLY,
];
const stapleIds = new Set(INTERACTION.map((c) => c.id));

const line = (
  cardId: number,
  quantity: number,
  source: GeneratedEntry['source'],
  zone: GeneratedEntry['zone'] = 'MAIN',
): GeneratedEntry => ({
  cardId,
  zone,
  quantity,
  owned: quantity,
  source,
  inclusion: null,
});

/** Un premier jet médiocre : un peu de moteur, beaucoup de compléments sans effet. */
const seed: GenerationResult = (() => {
  const entries = [
    line(BEWD.id, 3, 'ARCHETYPE'),
    line(SAGE.id, 1, 'ARCHETYPE'),
    line(ALTERNATIVE.id, 2, 'ARCHETYPE'),
    ...FILLERS.slice(0, 11).map((f) => line(f.id, 3, 'FILLER')),
    line(RANK7.id, 1, 'FILLER', 'EXTRA'),
  ];
  return {
    entries,
    counts: { MAIN: 39, EXTRA: 1, SIDE: 0 },
    missingCopies: 0,
    complete: false,
  };
})();

const pool: PoolCard[] = [
  ...ENGINE.map((c) => ({ cardId: c.id, source: 'ARCHETYPE' as const, owned: 3 })),
  ...EXTRAS.map((c) => ({ cardId: c.id, source: 'ARCHETYPE' as const, owned: 1 })),
  ...INTERACTION.map((c) => ({
    cardId: c.id,
    source: 'STAPLE' as const,
    owned: 3,
    prior: 1,
  })),
  ...FILLERS.map((c) => ({ cardId: c.id, source: 'FILLER' as const, owned: 3 })),
];

const run = () => optimizeDeck({ cards, pool, seed, scoring: { stapleIds } });
const copies = (r: GenerationResult, id: number) =>
  r.entries.filter((e) => e.cardId === id).reduce((s, e) => s + e.quantity, 0);
const zoneCopies = (r: GenerationResult, pred: (e: GeneratedEntry) => boolean) =>
  r.entries.filter(pred).reduce((s, e) => s + e.quantity, 0);

describe('optimizeDeck', () => {
  const out = run();

  it('fait mieux que le premier jet, et rend un deck jouable', () => {
    expect(out.score.raw).toBeGreaterThan(out.baseline.raw);
    expect(out.score.playable).toBe(true);
    expect(out.swaps).toBeGreaterThan(0);
  });

  it('respecte les tailles de zones', () => {
    expect(out.result.counts.MAIN).toBe(40);
    expect(out.result.counts.EXTRA).toBeLessThanOrEqual(15);
    expect(out.result.counts.SIDE).toBeLessThanOrEqual(15);
  });

  it('n’utilise que des exemplaires possédés, toutes zones confondues', () => {
    for (const id of new Set(out.result.entries.map((e) => e.cardId))) {
      expect(copies(out.result, id)).toBeLessThanOrEqual(owned.get(id)!);
    }
  });

  it('respecte la banlist et la légalité TCG', () => {
    expect(copies(out.result, FORBIDDEN.id)).toBe(0);
    expect(copies(out.result, OCG_ONLY.id)).toBe(0);
    // Limitée : un seul exemplaire dans tout le deck, Side compris
    expect(copies(out.result, STORM.id)).toBeLessThanOrEqual(1);
  });

  it('remplace les compléments sans effet par le moteur et les starters', () => {
    const fillers = (r: GenerationResult) =>
      zoneCopies(r, (e) => e.zone === 'MAIN' && FILLERS.some((f) => f.id === e.cardId));
    expect(fillers(out.result)).toBeLessThan(fillers(seed));
    expect(copies(out.result, SAGE.id)).toBe(3);
    expect(out.score.opening!).toBeGreaterThan(out.baseline.opening!);
  });

  it('ne garde dans l’Extra Deck que des monstres invocables avec ce main', () => {
    const main: DeckEntry[] = out.result.entries
      .filter((e) => e.zone === 'MAIN')
      .map((e) => ({ card: cards.get(e.cardId)!, quantity: e.quantity, zone: 'MAIN' }));
    const extra = out.result.entries.filter((e) => e.zone === 'EXTRA');
    expect(extra.length).toBeGreaterThan(0);
    for (const e of extra) expect(checkExtra(cards.get(e.cardId)!, main).reachable).toBe(true);
    // Big Eye (deux niveaux 7) n'entre que si le main en a : ici, seul Gameciel en est un
    const sevens = main.filter((e) => e.card.level === 7).reduce((s, e) => s + e.quantity, 0);
    expect(copies(out.result, RANK7.id) > 0).toBe(sevens >= 2);
  });

  it('met des cartes d’interaction restantes au Side', () => {
    const side = out.result.entries.filter((e) => e.zone === 'SIDE');
    expect(side.length).toBeGreaterThan(0);
    expect(side.every((e) => stapleIds.has(e.cardId))).toBe(true);
  });

  it('est déterministe : la même collection donne le même deck', () => {
    expect(run().result).toEqual(out.result);
  });

  it('la note rendue est celle d’une évaluation directe', () => {
    expect(evaluateDeck(out.result, cards, { stapleIds }).score.raw).toBeCloseTo(out.score.raw, 6);
  });

  it('ne retire jamais une carte verrouillée', () => {
    const locked = optimizeDeck({
      cards,
      pool,
      seed,
      scoring: { stapleIds },
      locked: new Set([FILLERS[0]!.id]),
    });
    expect(copies(locked.result, FILLERS[0]!.id)).toBe(3);
  });

  it('sans budget, rend le premier jet complété, noté', () => {
    const draft = optimizeDeck({ cards, pool, seed, scoring: { stapleIds }, budget: 0 });
    expect(draft.swaps).toBe(0);
    expect(draft.result.counts.MAIN).toBe(40);
    expect(draft.score.raw).toBeCloseTo(draft.baseline.raw, 6);
  });
});

describe('buildPool', () => {
  /** Carte inventée d'un AUTRE archétype, qui cherche nos Blue-Eyes : un second moteur. */
  const HELPER = opt({
    ...vanilla(9101),
    name: 'Dragon Keeper',
    desc: 'If this card is Normal Summoned: You can add 1 "Blue-Eyes" monster from your Deck to your hand.',
    type: 'Effect Monster',
    frameType: 'effect',
    archetype: 'Keepers',
  });
  /** Carte générique dont l'effet ne cite rien : elle « touche » tout, ce n'est pas un lien. */
  const ANYTHING = opt({
    ...vanilla(9102),
    name: 'Anything Goes',
    desc: 'Add 1 monster from your Deck to your hand.',
    type: 'Spell Card',
    frameType: 'spell',
    category: 'SPELL',
    race: 'Normal',
    level: null,
  });
  const local = new Map([...cards, [HELPER.id, HELPER], [ANYTHING.id, ANYTHING]]);
  const localOwned = new Map([...owned, [HELPER.id, 3], [ANYTHING.id, 3]]);
  const base = {
    seed: {
      ...seed,
      entries: [
        line(BEWD.id, 3, 'ARCHETYPE'),
        line(SAGE.id, 3, 'ARCHETYPE'),
        line(WHITE_STONE_LEGEND.id, 2, 'ARCHETYPE'),
      ],
    },
    sources: new Map(),
    archetype: 'Blue-Eyes',
    owned: localOwned,
    cards: local,
    staples: [{ cardId: ASH.id }],
    fillers: [],
    metaPlay: new Map(),
  };

  it('va chercher dans la collection les cartes vraiment reliées au cœur', () => {
    const got = buildPool({ ...base, collection: [...local.values()] });
    expect(got.find((p) => p.cardId === HELPER.id)?.source).toBe('SUPPORT');
    expect(got.some((p) => p.cardId === ANYTHING.id)).toBe(false);
  });

  it('propose les monstres d’Extra Deck invocables, pas les autres', () => {
    const got = buildPool({ ...base, collection: [...local.values()] });
    expect(got.some((p) => p.cardId === SPIRIT_DRAGON.id)).toBe(true);
    expect(got.some((p) => p.cardId === RANK7.id)).toBe(false);
  });

  it('sans collection, se limite au premier jet et à ce qu’on lui donne', () => {
    const got = buildPool(base);
    expect(got.map((p) => p.cardId).sort()).toEqual(
      [BEWD.id, SAGE.id, WHITE_STONE_LEGEND.id, ASH.id].sort(),
    );
  });

  it('dit ce que la légalité a coûté', () => {
    expect(legalityOf(pool, cards)).toEqual({ excluded: 2, capped: 1 });
  });
});

describe('utilitaires', () => {
  it('enginesOf : les archétypes qui portent le main', () => {
    const r: GenerationResult = {
      entries: [
        line(BEWD.id, 3, 'ARCHETYPE'),
        line(ALTERNATIVE.id, 3, 'ARCHETYPE'),
        line(ASH.id, 3, 'STAPLE'),
      ],
      counts: { MAIN: 9, EXTRA: 0, SIDE: 0 },
      missingCopies: 0,
      complete: false,
    };
    expect(enginesOf(r, cards)).toEqual(['Blue-Eyes']);
    expect(enginesOf(r, cards, 7)).toEqual([]);
  });

  it('overlap : part du main commune à deux decks', () => {
    const a: GenerationResult = {
      ...seed,
      counts: { MAIN: 6, EXTRA: 0, SIDE: 0 },
      entries: [line(1, 3, 'CORE'), line(2, 3, 'CORE')],
    };
    const b: GenerationResult = {
      ...seed,
      counts: { MAIN: 6, EXTRA: 0, SIDE: 0 },
      entries: [line(1, 3, 'CORE'), line(3, 3, 'CORE')],
    };
    expect(overlap(a, b)).toBeCloseTo(0.5);
    expect(overlap(a, a)).toBe(1);
  });
});
