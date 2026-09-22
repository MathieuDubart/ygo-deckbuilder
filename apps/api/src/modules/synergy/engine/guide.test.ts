import { describe, expect, it } from 'vitest';
import { findCombos } from './combos';
import { BLUE_EYES_DECK, RANK7, SAGE } from './fixtures';
import { analyzeDeck, type DeckEntry } from './graph';
import { translator } from '../../../common/i18n/locale-context';
import { buildRuleGuide, openingOdds } from './guide';

const deck: DeckEntry[] = BLUE_EYES_DECK.map(({ card, qty }) => ({
  card,
  quantity: qty,
  zone: card.isExtraDeck ? 'EXTRA' : 'MAIN',
}));
const names = new Map(deck.map((e) => [e.card.id, e.card.name]));
const a = analyzeDeck(deck);
const g = buildRuleGuide(
  deck,
  a,
  findCombos(deck, a),
  (id) => names.get(id) ?? '?',
  translator('fr'),
);

describe('probabilités d’ouverture', () => {
  it('calcule l’hypergéométrique', () => {
    expect(openingOdds(0, 40)).toBe(0);
    expect(openingOdds(40, 40)).toBe(1);
    // 9 starters sur 40, main de 5 : ≈ 74 %
    expect(openingOdds(9, 40)).toBeCloseTo(0.742, 2);
  });
});

describe('guide de jeu (Blue-Eyes)', () => {
  it('résume le deck et ses mécaniques', () => {
    expect(g.styles).toContain('Synchro');
    expect(g.summary).toContain('Blue-Eyes');
    expect(g.stats.find((s) => s.label === 'Starters')?.value).not.toBe('0');
  });

  it('met les starters dans les cartes clés', () => {
    expect(g.keyCards.map((k) => k.cardId)).toContain(SAGE.id);
    expect(g.keyCards.find((k) => k.cardId === SAGE.id)?.why).toMatch(/cherche/i);
  });

  it('écrit des combos lisibles', () => {
    expect(g.combos.length).toBeGreaterThan(0);
    const texts = g.combos.flatMap((c) => c.steps.map((s) => s.text));
    expect(texts.some((t) => t.startsWith('Invocation Synchro'))).toBe(true);
    expect(texts.every((t) => t.length > 0)).toBe(true);
  });

  it('signale les erreurs classiques', () => {
    const all = g.mistakes.join('\n');
    expect(all).toContain(RANK7.name); // Rank 7 impossible à invoquer
    expect(all).toMatch(/cimetière/);
  });
});

describe('guide en anglais', () => {
  it('même analyse, autre langue', () => {
    const en = buildRuleGuide(
      deck,
      a,
      findCombos(deck, a),
      (id) => names.get(id) ?? '?',
      translator('en'),
    );
    expect(en.summary).toMatch(/deck built around “Blue-Eyes”/);
    expect(en.combos[0]?.steps[0]?.text).toMatch(/^Normal Summon|Special Summon/);
    expect(en.mistakes.join(' ')).not.toMatch(/Invocation/);
  });
});
