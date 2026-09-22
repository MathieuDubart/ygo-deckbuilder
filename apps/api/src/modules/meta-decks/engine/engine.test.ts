import { describe, expect, it } from 'vitest';
import { clusterLists, nameGroup, tierFor } from './clustering';
import { buildConsensus } from './consensus';
import { REAL_LISTS } from './fixtures';
import {
  fillDeck,
  generateFromArchetype,
  generateFromTemplate,
  type GenCardInfo,
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
  const extraIds = new Set(kewl.lists.flatMap((l) => l.extra));
  const cards = new Map<number, GenCardInfo>(
    [...new Set(REAL_LISTS.flatMap((l) => [...l.main, ...l.extra, ...l.side]))].map((id) => [
      id,
      {
        id,
        isExtraDeck: extraIds.has(id) || REAL_LISTS.some((l) => l.extra.includes(id)),
        banTcg: null,
      },
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

  it('mode OWNED : seulement mes cartes, complété par staples puis archétype', () => {
    const owned = new Map<number, number>([
      [ASH, 3],
      [16387555, 3],
      [17209452, 1],
      [65961304, 1],
      [999, 3], // carte d'archétype hors liste
    ]);
    cards.set(999, { id: 999, isExtraDeck: false, banTcg: null });
    cards.set(1000, { id: 1000, isExtraDeck: false, banTcg: 'Limited' });
    owned.set(1000, 3);
    const r = generateFromTemplate(template, {
      mode: 'OWNED',
      cards,
      owned,
      staples: [{ cardId: 1000, avgCopies: 3 }],
      archetypeCards: [999],
    });
    expect(r.missingCopies).toBe(0);
    expect(r.entries.find((e) => e.cardId === 17209452)?.quantity).toBe(1);
    expect(r.entries.find((e) => e.cardId === 1000)).toMatchObject({
      quantity: 1,
      source: 'STAPLE',
    }); // limitée
    expect(r.entries.find((e) => e.cardId === 999)).toMatchObject({
      quantity: 3,
      source: 'ARCHETYPE',
    });
    expect(r.counts.MAIN).toBe(3 + 3 + 1 + 1 + 3);
    expect(r.complete).toBe(false);
  });
});

describe('fillDeck', () => {
  it('ne consomme pas deux fois un exemplaire possédé (main + side)', () => {
    const cards = new Map([[1, { id: 1, isExtraDeck: false, banTcg: null }]]);
    const r = fillDeck(
      [
        { cardId: 1, want: 2, source: 'CORE' },
        { cardId: 1, want: 1, source: 'CORE', zone: 'SIDE' },
      ],
      { cards, owned: new Map([[1, 2]]), onlyOwned: false, mainTarget: 40 },
    );
    expect(r.entries.map((e) => [e.zone, e.quantity, e.owned])).toEqual([
      ['MAIN', 2, 2],
      ['SIDE', 1, 0],
    ]);
  });

  it('range les monstres extra dans l’Extra Deck, même proposés en main', () => {
    const cards = new Map([[7, { id: 7, isExtraDeck: true, banTcg: null }]]);
    const r = fillDeck([{ cardId: 7, want: 1, source: 'CORE' }], {
      cards,
      owned: new Map(),
      onlyOwned: false,
      mainTarget: 40,
    });
    expect(r.entries[0]?.zone).toBe('EXTRA');
  });
});

describe('generateFromArchetype', () => {
  it('archétype d’abord, puis support, puis staples, dans la limite de 40', () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const cards = new Map(ids.map((id) => [id, { id, isExtraDeck: false, banTcg: null }]));
    const owned = new Map(ids.map((id) => [id, 3]));
    const r = generateFromArchetype({
      cards,
      owned,
      archetypeCards: ids.slice(0, 12),
      supportCards: [13, 14],
      staples: [{ cardId: 15, avgCopies: 3 }],
    });
    expect(r.counts.MAIN).toBe(40);
    expect(r.entries.filter((e) => e.source === 'ARCHETYPE').length).toBe(12); // 36 cartes
    expect(r.entries.find((e) => e.cardId === 13)?.quantity).toBe(2);
    expect(r.entries.find((e) => e.cardId === 14)?.quantity).toBe(2);
    expect(r.complete).toBe(true);
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
