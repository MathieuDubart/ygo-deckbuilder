import { describe, expect, it } from 'vitest';
import { computeCoverage } from './coverage';

describe('computeCoverage', () => {
  const req = [
    { cardId: 1, zone: 'MAIN' as const, quantity: 3, unitPrice: 2 },
    { cardId: 2, zone: 'MAIN' as const, quantity: 1, unitPrice: 10 },
    { cardId: 3, zone: 'EXTRA' as const, quantity: 2, unitPrice: null },
    { cardId: 4, zone: 'SIDE' as const, quantity: 3, unitPrice: 50 },
  ];

  it('calcule couverture, manquants et coût, en ignorant le side', () => {
    const r = computeCoverage(
      req,
      new Map([
        [1, 2],
        [3, 5],
      ]),
    );
    expect(r.requiredCopies).toBe(6);
    expect(r.ownedCopies).toBe(4);
    expect(r.coverage).toBeCloseTo(4 / 6);
    expect(r.estimatedCostToComplete).toBe(12); // 1×2 + 1×10
    expect(r.missing.map((m) => m.cardId)).toEqual([2, 1]); // trié par coût décroissant
  });

  it('ne compte pas deux fois un exemplaire requis dans deux zones', () => {
    const r = computeCoverage(
      [
        { cardId: 1, zone: 'MAIN', quantity: 1, unitPrice: 1 },
        { cardId: 1, zone: 'EXTRA', quantity: 1, unitPrice: 1 },
      ],
      new Map([[1, 1]]),
    );
    expect(r.ownedCopies).toBe(1);
    expect(r.missing).toHaveLength(1);
  });

  it('renvoie 0 pour une decklist vide', () => {
    expect(computeCoverage([], new Map()).coverage).toBe(0);
  });
});
