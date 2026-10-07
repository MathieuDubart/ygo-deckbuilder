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
export const PRODUCT_KINDS = ['BOOSTER', 'STRUCTURE', 'TIN', 'STARTER', 'BOX', 'OTHER'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Couleurs des pastilles d'étiquettes : des slugs résolus par le front, pas des valeurs CSS. */
export const TAG_COLORS = [
  'slate',
  'red',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/**
 * Où en est une extension par rapport à aujourd'hui. `RECENT` couvre les sorties des
 * {@link RECENT_RELEASE_DAYS} derniers jours : c'est ce qu'on met en avant avec les sorties
 * à venir, parce que c'est là qu'on ouvre des boosters.
 */
export const RELEASE_STATUSES = ['UPCOMING', 'RECENT', 'RELEASED'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** Une sortie reste « récente » pendant ce nombre de jours. */
export const RECENT_RELEASE_DAYS = 60;

/** Filtre d'avancement d'une extension : rien, commencée, complète. */
export const RELEASE_PROGRESS_FILTERS = ['NONE', 'STARTED', 'COMPLETE'] as const;
export type ReleaseProgressFilter = (typeof RELEASE_PROGRESS_FILTERS)[number];
