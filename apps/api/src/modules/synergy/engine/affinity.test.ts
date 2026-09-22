import { describe, expect, it } from 'vitest';
import { affinity, rankBySynergy } from './affinity';
import {
  ALTERNATIVE,
  BEWD,
  DICTATOR,
  RANK7,
  SAGE,
  TRADE_IN,
  WHITE_STONE_ANCIENTS,
  WHITE_STONE_LEGEND,
} from './fixtures';

const core = [BEWD, SAGE, WHITE_STONE_ANCIENTS, WHITE_STONE_LEGEND, ALTERNATIVE];

describe('affinité avec le cœur du deck', () => {
  it('préfère une carte qui interagit avec le moteur', () => {
    expect(affinity(core, DICTATOR)).toBeGreaterThan(affinity(core, RANK7));
    expect(affinity(core, DICTATOR)).toBeGreaterThan(2);
  });

  it('remonte les cartes liées sans jeter l’ordre de popularité', () => {
    const cards = new Map([DICTATOR, TRADE_IN, RANK7].map((c) => [c.id, c]));
    const ranked = rankBySynergy(core, [RANK7.id, TRADE_IN.id, DICTATOR.id], cards);
    expect(ranked[0]).toBe(DICTATOR.id);
  });
});
