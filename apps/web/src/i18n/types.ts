import type auth from '../../messages/en/auth.json';
import type cards from '../../messages/en/cards.json';
import type catalog from '../../messages/en/catalog.json';
import type collection from '../../messages/en/collection.json';
import type common from '../../messages/en/common.json';
import type duel from '../../messages/en/duel.json';
import type deckBuilder from '../../messages/en/deckBuilder.json';
import type decks from '../../messages/en/decks.json';
import type guide from '../../messages/en/guide.json';
import type layout from '../../messages/en/layout.json';
import type rules from '../../messages/en/rules.json';
import type products from '../../messages/en/products.json';
import type suggestions from '../../messages/en/suggestions.json';
import type wishlist from '../../messages/en/wishlist.json';

/** Forme des messages (référence : l'anglais) → clés vérifiées par TypeScript. */
export interface Messages {
  common: typeof common;
  layout: typeof layout;
  auth: typeof auth;
  catalog: typeof catalog;
  cards: typeof cards;
  collection: typeof collection;
  products: typeof products;
  wishlist: typeof wishlist;
  decks: typeof decks;
  deckBuilder: typeof deckBuilder;
  suggestions: typeof suggestions;
  guide: typeof guide;
  duel: typeof duel;
  rules: typeof rules;
}
