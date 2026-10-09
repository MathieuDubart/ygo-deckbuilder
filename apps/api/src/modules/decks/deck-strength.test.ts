import { describe, expect, it } from 'vitest';
import { scoreDeck } from '../meta-decks/engine/generator';
import { ASH, BEWD, BLUE_EYES_DECK, RAIGEKI, SAGE } from '../synergy/engine/fixtures';
import { analyzeDeck, type DeckEntry } from '../synergy/engine/graph';
import {
  asGenerationResult,
  connectedCards,
  dominantArchetype,
  sourceOf,
} from './deck-strength';

const entries = (list: { card: DeckEntry['card']; qty: number }[]): DeckEntry[] =>
  list.map(({ card, qty }) => ({
    card,
    quantity: qty,
    zone: card.isExtraDeck ? ('EXTRA' as const) : ('MAIN' as const),
  }));

const blueEyes = entries(BLUE_EYES_DECK);
const analysis = analyzeDeck(blueEyes);

describe('dominantArchetype', () => {
  it('trouve le thème d’un deck d’archétype', () => {
    expect(dominantArchetype(blueEyes)).toBe('Blue-Eyes');
  });

  it('ne retient pas un archétype qui ne fait que passer', () => {
    // Une seule carte d'archétype dans un deck de cartes sans thème
    const deck = entries([
      { card: BEWD, qty: 1 },
      { card: RAIGEKI, qty: 3 },
      { card: ASH, qty: 3 },
    ]);
    expect(dominantArchetype(deck)).toBeNull();
  });

  it('rend null sur un deck vide', () => {
    expect(dominantArchetype([])).toBeNull();
  });
});

describe('sourceOf', () => {
  const entry = { card: BEWD, quantity: 3, zone: 'MAIN' as const };

  it('un staple reste un staple, même dans son archétype', () => {
    const got = sourceOf(entry, {
      archetype: 'Blue-Eyes',
      stapleIds: new Set([BEWD.id]),
      connected: new Set(),
    });
    expect(got).toBe('STAPLE');
  });

  it('une carte de l’archétype dominant est le cœur du deck', () => {
    const got = sourceOf(entry, {
      archetype: 'Blue-Eyes',
      stapleIds: new Set(),
      connected: new Set(),
    });
    expect(got).toBe('ARCHETYPE');
  });

  it('une carte reliée au reste fait tourner le deck, même sans archétype', () => {
    const got = sourceOf(entry, {
      archetype: null,
      stapleIds: new Set(),
      connected: new Set([BEWD.id]),
    });
    expect(got).toBe('SUPPORT');
  });

  it('une carte isolée et banale est du remplissage', () => {
    const got = sourceOf(entry, { archetype: null, stapleIds: new Set(), connected: new Set() });
    expect(got).toBe('FILLER');
  });
});

describe('connectedCards', () => {
  it('ignore les simples mentions', () => {
    const connected = connectedCards({
      ...analysis,
      edges: [{ from: 1, to: 2, verb: 'MENTION' }],
    });
    expect(connected.size).toBe(0);
  });

  it('ignore une carte qui ne se relie qu’à elle-même', () => {
    const connected = connectedCards({ ...analysis, edges: [{ from: 1, to: 1, verb: 'SEARCH' }] });
    expect(connected.size).toBe(0);
  });

  it('retient les deux bouts d’un vrai lien', () => {
    const connected = connectedCards(analysis);
    expect(connected.has(SAGE.id)).toBe(true);
  });
});

describe('asGenerationResult', () => {
  it('rend un deck notable par scoreDeck', () => {
    const result = asGenerationResult(blueEyes, analysis, new Set([ASH.id]));
    const score = scoreDeck(result, {
      stapleIds: new Set([ASH.id]),
      synergy: { score: analysis.synergy.score, starterCopies: analysis.synergy.starterCopies },
    });
    expect(score.score).toBeGreaterThan(0);
    expect(score.score).toBeLessThanOrEqual(100);
    // Un vrai deck d'archétype doit avoir un moteur, pas que du remplissage
    expect(score.engineShare).toBeGreaterThan(0.4);
    expect(score.fillerShare).toBeLessThan(0.3);
  });

  it('compte les zones séparément', () => {
    const result = asGenerationResult(blueEyes, analysis, new Set());
    expect(result.counts.MAIN).toBe(26);
    expect(result.counts.EXTRA).toBe(7);
    expect(result.counts.SIDE).toBe(0);
  });

  it('considère possédé tout ce qui est dans le deck', () => {
    const result = asGenerationResult(blueEyes, analysis, new Set());
    expect(result.entries.every((e) => e.owned === e.quantity)).toBe(true);
    expect(result.missingCopies).toBe(0);
  });

  it('note plus bas un tas de cartes sans lien qu’un vrai deck', () => {
    // Même nombre de cartes, mais rien ne se parle : la note doit le dire
    const heap = entries([
      { card: RAIGEKI, qty: 3 },
      { card: BEWD, qty: 3 },
    ]);
    const heapAnalysis = analyzeDeck(heap);
    const heapScore = scoreDeck(asGenerationResult(heap, heapAnalysis, new Set()), {
      synergy: {
        score: heapAnalysis.synergy.score,
        starterCopies: heapAnalysis.synergy.starterCopies,
      },
    });
    const deckScore = scoreDeck(asGenerationResult(blueEyes, analysis, new Set()), {
      synergy: { score: analysis.synergy.score, starterCopies: analysis.synergy.starterCopies },
    });
    expect(deckScore.score).toBeGreaterThan(heapScore.score);
  });
});
