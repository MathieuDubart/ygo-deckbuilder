import type { CardSetDto, OfficialDeckKind } from '@ygo/shared';

/** Produit jouable tel quel : structure deck, starter, ou « … Deck » (hors coffrets et tins). */
export function isDeckProduct(set: Pick<CardSetDto, 'kind' | 'name'>): boolean {
  if (set.kind === 'STRUCTURE' || set.kind === 'STARTER') return true;
  return set.kind === 'OTHER' && /\bdeck\b/i.test(set.name) && !/booster|pack/i.test(set.name);
}

/**
 * Catégorie d'un deck officiel pour le filtre des suggestions. Un produit qui contient
 * plusieurs decks (Legendary Decks, coffrets…) est un coffret, sauf s'il est vendu comme starter
 * (2-Player Starter Set) ; un produit « … Deck » non classé est rangé avec les structure decks.
 */
export function officialDeckKind(
  productKind: CardSetDto['kind'],
  decksInProduct: number,
): OfficialDeckKind {
  if (productKind === 'STRUCTURE' || productKind === 'STARTER' || productKind === 'BOX') {
    return productKind;
  }
  return decksInProduct >= 2 ? 'BOX' : 'STRUCTURE';
}
