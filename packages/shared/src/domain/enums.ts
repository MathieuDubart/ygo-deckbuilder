/**
 * Enums métier partagés. Doivent rester alignés avec les enums du schéma Prisma
 * (apps/api/prisma/schema.prisma) — la DB est la source de vérité.
 */

export const CARD_CATEGORIES = ['MONSTER', 'SPELL', 'TRAP', 'SKILL', 'TOKEN'] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

export const DECK_ZONES = ['MAIN', 'EXTRA', 'SIDE'] as const;
export type DeckZone = (typeof DECK_ZONES)[number];

export const DECK_FORMATS = ['TCG', 'OCG', 'GOAT', 'EDISON', 'CASUAL'] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

export const CARD_CONDITIONS = [
  'MINT',
  'NEAR_MINT',
  'EXCELLENT',
  'GOOD',
  'LIGHT_PLAYED',
  'PLAYED',
  'POOR',
] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const CARD_LANGUAGES = ['FR', 'EN', 'DE', 'IT', 'ES', 'PT', 'JP', 'KR'] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export const WISHLIST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

/** Type de produit, déduit du nom (YGOPRODeck ne le fournit pas). */
export const PRODUCT_KINDS = ['STRUCTURE', 'TIN', 'STARTER', 'BOX', 'OTHER'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
