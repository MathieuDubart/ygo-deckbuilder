import { describe, expect, it } from 'vitest';
import {
  banStatusOf,
  banlistFixes,
  maxCopiesFor,
  validateDeck,
  type DeckEntryForValidation,
} from './deck-rules';

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

  it('distingue une carte interdite d’un simple surnombre', () => {
    const issues = validateDeck([
      { cardId: 7, zone: 'MAIN', quantity: 1, isExtraDeckMonster: false, banStatus: 'Banned' },
    ]);
    // « 1 exemplaire sur 0 autorisé » ne veut rien dire : c'est une interdiction, pas un quota
    expect(issues).toContainEqual({ code: 'FORBIDDEN', cardId: 7, count: 1 });
    expect(issues.some((i) => i.code === 'TOO_MANY_COPIES')).toBe(false);
  });

  it('ne signale rien sur une carte interdite absente du deck', () => {
    const issues = validateDeck([
      { cardId: 7, zone: 'MAIN', quantity: 0, isExtraDeckMonster: false, banStatus: 'Forbidden' },
    ]);
    expect(issues.some((i) => i.code === 'FORBIDDEN')).toBe(false);
  });
});

describe('banStatusOf', () => {
  it('normalise les libellés des différentes sources', () => {
    expect(banStatusOf('Banned')).toBe('FORBIDDEN');
    expect(banStatusOf('forbidden')).toBe('FORBIDDEN');
    expect(banStatusOf('Semi-Limited')).toBe('SEMI_LIMITED');
    expect(banStatusOf('semi limited')).toBe('SEMI_LIMITED');
    expect(banStatusOf('  Limited ')).toBe('LIMITED');
  });

  it('ignore ce qui n’est pas un statut', () => {
    expect(banStatusOf(null)).toBeNull();
    expect(banStatusOf('')).toBeNull();
    expect(banStatusOf('Unlimited')).toBeNull();
  });
});

describe('maxCopiesFor', () => {
  it('mappe les statuts banlist', () => {
    expect(maxCopiesFor('Forbidden')).toBe(0);
    expect(maxCopiesFor('Semi-Limited')).toBe(2);
    expect(maxCopiesFor(null)).toBe(3);
  });

  it('retombe sur 3 pour un libellé inconnu plutôt que d’interdire la carte', () => {
    expect(maxCopiesFor('Whatever')).toBe(3);
  });
});

describe('banlistFixes', () => {
  const main = (cardId: number, quantity: number, banStatus?: string): DeckEntryForValidation => ({
    cardId,
    zone: 'MAIN',
    quantity,
    isExtraDeckMonster: false,
    banStatus,
  });

  it('ne touche à rien quand la liste est légale', () => {
    expect(banlistFixes([main(1, 3), main(2, 2, 'Semi-Limited')])).toEqual([]);
  });

  it('retire tous les exemplaires d’une carte interdite', () => {
    expect(banlistFixes([main(7, 2, 'Banned')])).toEqual([{ cardId: 7, zone: 'MAIN', remove: 2 }]);
  });

  it('ne retire que le surnombre d’une carte limitée', () => {
    expect(banlistFixes([main(5, 3, 'Limited')])).toEqual([{ cardId: 5, zone: 'MAIN', remove: 2 }]);
  });

  it('sacrifie le side avant le deck joué', () => {
    const fixes = banlistFixes([
      main(5, 1, 'Limited'),
      { cardId: 5, zone: 'SIDE', quantity: 1, isExtraDeckMonster: false, banStatus: 'Limited' },
    ]);
    expect(fixes).toEqual([{ cardId: 5, zone: 'SIDE', remove: 1 }]);
  });

  it('déborde sur le main quand vider le side ne suffit pas', () => {
    const fixes = banlistFixes([
      main(5, 2, 'Limited'),
      { cardId: 5, zone: 'SIDE', quantity: 2, isExtraDeckMonster: false, banStatus: 'Limited' },
    ]);
    expect(fixes).toEqual([
      { cardId: 5, zone: 'SIDE', remove: 2 },
      { cardId: 5, zone: 'MAIN', remove: 1 },
    ]);
  });

  it('corrige exactement ce que validateDeck reprochait', () => {
    const entries = [main(1, 40), main(5, 3, 'Limited'), main(7, 1, 'Forbidden')];
    const removed = new Map(banlistFixes(entries).map((f) => [`${f.zone}:${f.cardId}`, f.remove]));
    const fixed = entries.map((e) => ({
      ...e,
      quantity: e.quantity - (removed.get(`${e.zone}:${e.cardId}`) ?? 0),
    }));
    const left = validateDeck(fixed).filter(
      (i) => i.code === 'FORBIDDEN' || i.code === 'TOO_MANY_COPIES',
    );
    expect(left).toEqual([]);
  });
});
