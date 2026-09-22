import { describe, expect, it } from 'vitest';
import { productCards } from './quantities';

const p = (
  id: string,
  cardId: number,
  printCode: string,
  rarity: string,
  setQuantity: number | null,
) => ({
  id,
  cardId,
  printCode,
  rarity,
  setQuantity,
});

describe('quantités par produit', () => {
  it('quantité officielle, sinon 1', () => {
    const cards = productCards([
      p('a', 1, 'SDBE-EN001', 'UR', 3),
      p('b', 2, 'SDBE-EN002', 'C', null),
    ]);
    expect(cards).toEqual([
      { cardId: 1, printId: 'a', printCode: 'SDBE-EN001', rarity: 'UR', quantity: 3 },
      { cardId: 2, printId: 'b', printCode: 'SDBE-EN002', rarity: 'C', quantity: 1 },
    ]);
  });

  it('même code en deux raretés : pas de double compte ; deux codes : on additionne', () => {
    const [c] = productCards([
      p('a', 7, 'LDS3-EN009', 'UR', 3),
      p('b', 7, 'LDS3-EN009', 'ScR', 3),
      p('c', 7, 'LDS3-EN135', 'UR', 1),
    ]);
    expect(c?.quantity).toBe(4);
    expect(c?.printId).toBe('a');
  });
});
