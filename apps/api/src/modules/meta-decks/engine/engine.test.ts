import { describe, expect, it } from 'vitest';
import { clusterLists, nameGroup, tierFor } from './clustering';
import { buildConsensus } from './consensus';
import { REAL_LISTS } from './fixtures';
import {
  DeckAssembler,
  fillDeck,
  generateFromArchetype,
  copyLimit,
  generateFromTemplate,
  interactionScore,
  openingOdds,
  scoreDeck,
  topUp,
  type GenCardInfo,
  type GeneratedEntry,
  type GenerationResult,
  type SynergyInput,
} from './generator';
import { cardStats, crossArchetypeStaples } from './stats';

const ASH = 14558127;

describe('cardStats / staples', () => {
  it('mesure la popularité de chaque carte', () => {
    expect(cardStats(REAL_LISTS).get(ASH)).toEqual({ share: 1, avgCopies: 3 });
  });

  it('staple = joué par plusieurs archétypes, pas juste par le deck dominant', () => {
    const staples = crossArchetypeStaples(clusterLists(REAL_LISTS).map((c) => c.lists));
    expect(staples.has(ASH)).toBe(true);
    expect(staples.has(16387555)).toBe(false); // carte moteur Kewl Tune (50 % des listes)
  });
});

describe('clusterLists (données réelles)', () => {
  const clusters = clusterLists(REAL_LISTS);
  const byName = (n: string) => clusters.find((c) => c.name === n);

  it('regroupe par contenu, pas par nom', () => {
    // "Synchron Kewl Tune" rejoint les "Kewl Tune"
    expect(
      byName('Kewl Tune')
        ?.lists.map((l) => l.id)
        .sort(),
    ).toEqual([733702, 733714, 733722, 733862]);
    // "Angelechy Elfnote" rejoint "Elfnote" ; les deux Blitzclique ensemble
    expect(clusters.map((c) => c.lists.length)).toEqual([4, 2, 2]);
  });

  it('garde les autres noms comme variantes et calcule la part du meta', () => {
    const kewl = byName('Kewl Tune')!;
    expect(kewl.variants).toContain('Synchron Kewl Tune');
    expect(kewl.share).toBe(0.5);
    expect(kewl.tier).toBe(1);
  });
});

describe('buildConsensus', () => {
  const kewl = clusterLists(REAL_LISTS)[0]!;
  const t = buildConsensus(kewl.lists);
  const qty = (id: number, zone = 'MAIN') =>
    t.cards.find((c) => c.cardId === id && c.zone === zone);

  it('produit un main de 40, un extra de 15 et un side de 15', () => {
    const sum = (z: string) =>
      t.cards.filter((c) => c.zone === z).reduce((s, c) => s + c.quantity, 0);
    expect([sum('MAIN'), sum('EXTRA'), sum('SIDE')]).toEqual([40, 15, 15]);
  });

  it('prend le nombre d’exemplaires le plus joué', () => {
    expect(qty(ASH)).toMatchObject({ quantity: 3, inclusion: 1 });
    expect(qty(16509007)?.quantity).toBe(3); // 3 copies dans 3 listes sur 4
  });

  it('garde les cartes moins jouées en "flex"', () => {
    expect(t.flex.length).toBeGreaterThan(0);
    expect(t.flex.every((f) => f.inclusion < 1)).toBe(true);
  });
});

describe('générateur', () => {
  const kewl = clusterLists(REAL_LISTS)[0]!;
  const template = buildConsensus(kewl.lists);
  const extraIds = new Set(REAL_LISTS.flatMap((l) => l.extra));
  const cards = new Map<number, GenCardInfo>(
    [...new Set(REAL_LISTS.flatMap((l) => [...l.main, ...l.extra, ...l.side]))].map((id) => [
      id,
      { id, isExtraDeck: extraIds.has(id), banTcg: null, category: 'MONSTER' as const },
    ]),
  );

  it('mode META : la liste type, avec ce qui manque', () => {
    const r = generateFromTemplate(template, {
      mode: 'META',
      cards,
      owned: new Map([[ASH, 2]]),
      staples: [],
      archetypeCards: [],
    });
    expect(r.counts).toEqual({ MAIN: 40, EXTRA: 15, SIDE: 15 });
    const ash = r.entries.find((e) => e.cardId === ASH && e.zone === 'MAIN')!;
    expect(ash).toMatchObject({ quantity: 3, owned: 2 });
    expect(r.missingCopies).toBe(70 - 2);
  });

  it('mode OWNED : seulement mes cartes, archétype avant staples', () => {
    const owned = new Map<number, number>([
      [ASH, 3],
      [16387555, 3],
      [17209452, 1],
      [65961304, 1],
      [999, 3],
      [1000, 3],
    ]);
    const local = new Map(cards);
    local.set(999, { id: 999, isExtraDeck: false, banTcg: null, category: 'MONSTER' });
    local.set(1000, { id: 1000, isExtraDeck: false, banTcg: 'Limited', category: 'SPELL' });
    const r = generateFromTemplate(template, {
      mode: 'OWNED',
      cards: local,
      owned,
      staples: [{ cardId: 1000, avgCopies: 3 }],
      archetypeCards: [999],
    });
    expect(r.missingCopies).toBe(0);
    expect(r.entries.find((e) => e.cardId === 17209452)?.quantity).toBe(1);
    expect(r.entries.find((e) => e.cardId === 1000)).toMatchObject({
      quantity: 1,
      source: 'STAPLE',
    });
    expect(r.entries.find((e) => e.cardId === 999)).toMatchObject({
      quantity: 3,
      source: 'ARCHETYPE',
    });
    expect(r.complete).toBe(false); // pas assez de cartes et aucun complément fourni
  });

  it('mode OWNED : complète jusqu’à 40 avec des cartes génériques', () => {
    const generic = Array.from({ length: 30 }, (_, i) => 5000 + i);
    const local = new Map(cards);
    generic.forEach((id, i) =>
      local.set(id, {
        id,
        isExtraDeck: false,
        banTcg: null,
        category: i % 3 === 0 ? 'MONSTER' : i % 3 === 1 ? 'SPELL' : 'TRAP',
      }),
    );
    const owned = new Map<number, number>([
      ...template.cards
        .filter((c) => c.zone === 'MAIN')
        .map((c) => [c.cardId, c.quantity] as [number, number])
        .slice(0, 8),
      ...generic.map((id) => [id, 3] as [number, number]),
    ]);
    const r = generateFromTemplate(template, {
      mode: 'OWNED',
      cards: local,
      owned,
      staples: [],
      archetypeCards: [],
      fillers: generic,
    });
    expect(r.counts.MAIN).toBe(40);
    expect(r.complete).toBe(true);
    expect(r.missingCopies).toBe(0);
    expect(r.entries.some((e) => e.source === 'FILLER')).toBe(true);
  });
});

describe('topUp', () => {
  it('équilibre monstres / magies / pièges', () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    const kind = (id: number) =>
      (id <= 20 ? 'MONSTER' : id <= 40 ? 'SPELL' : 'TRAP') as 'MONSTER' | 'SPELL' | 'TRAP';
    const cards = new Map(
      ids.map((id) => [id, { id, isExtraDeck: false, banTcg: null, category: kind(id) }]),
    );
    const deck = new DeckAssembler({
      cards,
      owned: new Map(ids.map((id) => [id, 3])),
      onlyOwned: true,
      mainTarget: 40,
    });
    topUp(
      deck,
      ids.map((id) => ({ cardId: id, want: 2, source: 'FILLER' })),
      cards,
    );
    expect(deck.counts.MAIN).toBe(40);
    expect(deck.mainByKind.MONSTER).toBeGreaterThanOrEqual(18);
    expect(deck.mainByKind.MONSTER).toBeLessThanOrEqual(22);
    expect(deck.mainByKind.TRAP).toBeLessThanOrEqual(8);
  });

  it('ajoute des monstres génériques dans l’Extra Deck', () => {
    const cards = new Map([
      [1, { id: 1, isExtraDeck: true, banTcg: null, category: 'MONSTER' as const }],
    ]);
    const deck = new DeckAssembler({
      cards,
      owned: new Map([[1, 2]]),
      onlyOwned: true,
      mainTarget: 40,
    });
    topUp(deck, [{ cardId: 1, want: 2, source: 'FILLER' }], cards);
    expect(deck.counts.EXTRA).toBe(1);
  });
});

describe('scoreDeck', () => {
  const entry = (
    id: number,
    quantity: number,
    source: GeneratedEntry['source'],
  ): GeneratedEntry => ({
    cardId: id,
    zone: 'MAIN',
    quantity,
    owned: quantity,
    source,
    inclusion: null,
  });
  const result = (entries: GeneratedEntry[]): GenerationResult => ({
    entries,
    counts: { MAIN: entries.reduce((s, e) => s + e.quantity, 0), EXTRA: 0, SIDE: 0 },
    missingCopies: 0,
    complete: entries.reduce((s, e) => s + e.quantity, 0) >= 40,
  });

  it('un deck au moteur dense, en 3 exemplaires, avec staples, est jouable et bien noté', () => {
    const r = result([
      ...Array.from({ length: 9 }, (_, i) => entry(i + 1, 3, 'ARCHETYPE')), // 27
      ...Array.from({ length: 3 }, (_, i) => entry(100 + i, 3, 'STAPLE')), // 9
      entry(200, 2, 'FILLER'),
      entry(201, 2, 'FILLER'), // 4
    ]);
    const s = scoreDeck(r);
    expect(s.playable).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(75);
    expect(s.consistency).toBe(1);
  });

  it('compte les staples de la liste type comme staples, pas comme moteur', () => {
    const r = result([
      ...Array.from({ length: 11 }, (_, i) => entry(i + 1, 3, 'CORE')), // 33 dont Ash
      entry(200, 2, 'FILLER'),
      entry(201, 2, 'FILLER'),
      entry(202, 3, 'FILLER'),
    ]);
    const s = scoreDeck(r, { stapleIds: new Set([1]) });
    expect(s.staples).toBe(3);
    expect(s.engineShare).toBeCloseTo(30 / 40);
  });

  it('un tas de cartes génériques n’est pas jouable', () => {
    const r = result([
      ...Array.from({ length: 5 }, (_, i) => entry(i + 1, 3, 'ARCHETYPE')), // 15
      ...Array.from({ length: 13 }, (_, i) => entry(100 + i, 2, 'FILLER')), // 26
    ]);
    const s = scoreDeck(r);
    expect(s.playable).toBe(false);
    expect(s.score).toBeLessThan(50);
  });
});

describe('scoreDeck : note complète (avec l’analyse de synergie)', () => {
  const entry = (
    id: number,
    quantity: number,
    source: GeneratedEntry['source'],
  ): GeneratedEntry => ({
    cardId: id,
    zone: 'MAIN',
    quantity,
    owned: quantity,
    source,
    inclusion: null,
  });
  const result = (entries: GeneratedEntry[]): GenerationResult => ({
    entries,
    counts: { MAIN: entries.reduce((s, e) => s + e.quantity, 0), EXTRA: 0, SIDE: 0 },
    missingCopies: 0,
    complete: true,
  });
  // 8 cartes moteur × 3 + 4 hand traps × 3 + 2 × 2 compléments = 40
  const engine = Array.from({ length: 8 }, (_, i) => entry(i + 1, 3, 'ARCHETYPE'));
  const traps = Array.from({ length: 4 }, (_, i) => entry(100 + i, 3, 'STAPLE'));
  const deck = result([...engine, ...traps, entry(200, 2, 'FILLER'), entry(201, 2, 'FILLER')]);
  const synergy = (over: Partial<SynergyInput> = {}): SynergyInput => ({
    score: 0.8,
    starterCopies: 12,
    interactionIds: new Set([100, 101, 102, 103]),
    brickIds: new Set<number>(),
    ...over,
  });

  it('rend la probabilité d’ouvrir et l’interaction', () => {
    const s = scoreDeck(deck, { synergy: synergy() });
    expect(s.opening).toBeCloseTo(openingOdds(12, 40));
    expect(s.interaction).toBe(12);
    expect(s.bricks).toBe(0);
    expect(s.playable).toBe(true);
    expect(s.raw).toBeCloseTo(s.score / 100, 2);
  });

  it('récompense les starters : plus de mains qui démarrent', () => {
    const few = scoreDeck(deck, { synergy: synergy({ starterCopies: 5 }) });
    const many = scoreDeck(deck, { synergy: synergy({ starterCopies: 15 }) });
    expect(many.raw).toBeGreaterThan(few.raw);
  });

  it('pénalise les briques qu’on risque d’avoir en main', () => {
    const clean = scoreDeck(deck, { synergy: synergy() });
    const bricky = scoreDeck(deck, { synergy: synergy({ brickIds: new Set([1, 2]) }) });
    expect(bricky.bricks).toBe(6);
    expect(bricky.raw).toBeLessThan(clean.raw);
  });

  it('préfère un moteur joué en tournoi, sans compter les staples', () => {
    const rogue = scoreDeck(deck, { synergy: synergy(), metaPlay: new Map([[100, 0.9]]) });
    const proven = scoreDeck(deck, {
      synergy: synergy(),
      metaPlay: new Map(engine.map((e) => [e.cardId, 0.2])),
    });
    expect(proven.raw).toBeGreaterThan(rogue.raw);
  });

  it('un tas de hand traps n’est pas un deck', () => {
    const pile = result([
      ...Array.from({ length: 5 }, (_, i) => entry(i + 1, 3, 'ARCHETYPE')),
      ...Array.from({ length: 8 }, (_, i) => entry(100 + i, 3, 'STAPLE')),
      entry(200, 1, 'FILLER'),
    ]);
    const s = scoreDeck(pile, {
      synergy: synergy({ interactionIds: new Set(Array.from({ length: 8 }, (_, i) => 100 + i)) }),
    });
    expect(s.interaction).toBe(24);
    expect(s.playable).toBe(false);
    expect(s.raw).toBeLessThan(scoreDeck(deck, { synergy: synergy() }).raw);
  });
});

describe('openingOdds', () => {
  it('suit la loi hypergéométrique', () => {
    expect(openingOdds(0, 40)).toBe(0);
    expect(openingOdds(40, 40)).toBe(1);
    // 1 - C(31,5)/C(40,5)
    expect(openingOdds(9, 40)).toBeCloseTo(1 - 169911 / 658008, 6);
    expect(openingOdds(15, 40)).toBeGreaterThan(openingOdds(12, 40));
  });

  it('se lit aussi pour un deck plus gros (plus dur d’ouvrir)', () => {
    expect(openingOdds(12, 60)).toBeLessThan(openingOdds(12, 40));
  });
});

describe('interactionScore', () => {
  it('monte jusqu’à 12, plafonne, puis baisse au-delà de 16', () => {
    expect(interactionScore(6, 40)).toBeCloseTo(0.5);
    expect(interactionScore(12, 40)).toBe(1);
    expect(interactionScore(16, 40)).toBe(1);
    expect(interactionScore(22, 40)).toBeLessThan(1);
  });
});

describe('copyLimit', () => {
  it('banlist TCG, et zéro pour une carte hors TCG', () => {
    expect(copyLimit({ banTcg: null })).toBe(3);
    expect(copyLimit({ banTcg: 'Limited' })).toBe(1);
    expect(copyLimit({ banTcg: 'Semi-Limited' })).toBe(2);
    expect(copyLimit({ banTcg: 'Banned' })).toBe(0);
    expect(copyLimit({ banTcg: null, tcgLegal: false })).toBe(0);
  });

  it('le générateur n’ajoute jamais une carte hors TCG', () => {
    const cards = new Map<number, GenCardInfo>([
      [1, { id: 1, isExtraDeck: false, banTcg: null, category: 'MONSTER', tcgLegal: false }],
    ]);
    const deck = new DeckAssembler({
      cards,
      owned: new Map([[1, 3]]),
      onlyOwned: true,
      mainTarget: 40,
    });
    expect(deck.add({ cardId: 1, want: 3, source: 'ARCHETYPE' })).toBe(0);
  });
});

describe('utilitaires', () => {
  it('nomme un groupe par son nom le plus fréquent', () => {
    expect(nameGroup(REAL_LISTS.slice(0, 4)).name).toBe('Kewl Tune');
  });
  it('tiers', () => {
    expect([tierFor(0.2), tierFor(0.06), tierFor(0.01)]).toEqual([1, 2, 3]);
  });
});
