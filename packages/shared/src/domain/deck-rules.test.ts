import { describe, expect, it } from 'vitest';
import { maxCopiesFor, validateDeck } from './deck-rules';

describe('validateDeck', () => {
  it('signale un main deck trop petit et une carte limitée en trop', () => {
    const issues = validateDeck([
      { cardId: 1, zone: 'MAIN', quantity: 3, isExtraDeckMonster: false },
      { cardId: 2, zone: 'MAIN', quantity: 2, isExtraDeckMonster: false, banStatus: 'Limited' },
    ]);
    expect(issues).toContainEqual({ code: 'ZONE_TOO_SMALL', zone: 'MAIN', count: 5, limit: 40 });
    expect(issues).toContainEqual({ code: 'TOO_MANY_COPIES', cardId: 2, count: 2, limit: 1 });
  });

  it('refuse un monstre extra deck dans le main', () => {
    const issues = validateDeck([
      { cardId: 9, zone: 'MAIN', quantity: 1, isExtraDeckMonster: true },
    ]);
    expect(issues).toContainEqual({ code: 'WRONG_ZONE', cardId: 9, zone: 'MAIN' });
  });

  it('compte les copies main + side ensemble', () => {
    const issues = validateDeck([
      { cardId: 1, zone: 'MAIN', quantity: 3, isExtraDeckMonster: false },
      { cardId: 1, zone: 'SIDE', quantity: 1, isExtraDeckMonster: false },
    ]);
    expect(issues).toContainEqual({ code: 'TOO_MANY_COPIES', cardId: 1, count: 4, limit: 3 });
  });
});

describe('maxCopiesFor', () => {
  it('mappe les statuts banlist', () => {
    expect(maxCopiesFor('Forbidden')).toBe(0);
    expect(maxCopiesFor('Semi-Limited')).toBe(2);
    expect(maxCopiesFor(null)).toBe(3);
  });
});
