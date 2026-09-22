import { describe, expect, it } from 'vitest';
import { isDeckProduct, officialDeckKind } from './product-kind';

describe('officialDeckKind', () => {
  it('garde les catégories connues', () => {
    expect(officialDeckKind('STRUCTURE', 1)).toBe('STRUCTURE');
    expect(officialDeckKind('STARTER', 2)).toBe('STARTER'); // 2-Player Starter Set
    expect(officialDeckKind('BOX', 3)).toBe('BOX');
  });

  it('range un produit non classé à plusieurs decks dans les coffrets', () => {
    expect(officialDeckKind('OTHER', 3)).toBe('BOX');
    expect(officialDeckKind('TIN', 2)).toBe('BOX');
  });

  it('range un « … Deck » non classé avec les structure decks', () => {
    expect(officialDeckKind('OTHER', 1)).toBe('STRUCTURE');
  });
});

describe('isDeckProduct', () => {
  it('reconnaît les decks jouables tels quels', () => {
    expect(isDeckProduct({ kind: 'STARTER', name: '2-Player Starter Set' })).toBe(true);
    expect(isDeckProduct({ kind: 'OTHER', name: 'Egyptian God Deck: Slifer' })).toBe(true);
    expect(isDeckProduct({ kind: 'OTHER', name: 'Deck Build Pack: Genesis Impactors' })).toBe(false);
    expect(isDeckProduct({ kind: 'BOX', name: "Legendary 5D's Decks" })).toBe(false);
  });
});
