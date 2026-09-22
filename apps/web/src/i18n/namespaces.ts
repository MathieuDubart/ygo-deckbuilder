/**
 * Messages découpés par domaine : un fichier JSON par namespace et par langue
 * (messages/<locale>/<namespace>.json). L'anglais est la référence des clés (types).
 */
export const NAMESPACES = [
  'common',
  'layout',
  'auth',
  'catalog',
  'cards',
  'collection',
  'products',
  'wishlist',
  'decks',
  'deckBuilder',
  'suggestions',
  'guide',
  'duel',
  'rules',
] as const;
export type Namespace = (typeof NAMESPACES)[number];
