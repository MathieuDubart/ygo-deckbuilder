import { z } from 'zod';
import { CARD_CATEGORIES, CARD_CONDITIONS, CARD_LANGUAGES } from '../domain/enums';
import type { CardLanguage } from '../domain/enums';
import { paginationSchema } from './pagination';
import { tagIdsSchema } from './tags';

export const addCollectionItemSchema = z.object({
  cardId: z.number().int().positive(),
  printId: z.string().optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  condition: z.enum(CARD_CONDITIONS).default('NEAR_MINT'),
  /**
   * Omise, elle vaut la langue de collection de l'utilisateur. Volontairement sans défaut
   * ici : un défaut figé rangerait les cartes de tout le monde dans la même langue, et
   * c'est exactement ce qui mélangeait les collections.
   */
  language: z.enum(CARD_LANGUAGES).optional(),
  firstEdition: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});
export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;

export const updateCollectionItemSchema = addCollectionItemSchema
  .omit({ cardId: true })
  .partial()
  .extend({ quantity: z.number().int().min(0).max(99).optional() });
export type UpdateCollectionItemInput = z.infer<typeof updateCollectionItemSchema>;

/** Ajout en masse d'un set entier (ex: un Structure Deck possédé). */
export const importSetSchema = z.object({
  setName: z.string().min(1).max(200),
  copies: z.number().int().min(1).max(10).default(1),
  /** Omise, elle vaut la langue de collection de l'utilisateur. */
  language: z.enum(CARD_LANGUAGES).optional(),
  /**
   * Poser aussi les decks du produit dans « Mes decks ». Sans effet sur un produit qui n'en
   * contient pas — un booster n'a pas de liste officielle.
   */
  createDecks: z.boolean().default(false),
});
export type ImportSetInput = z.infer<typeof importSetSchema>;

export const collectionQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  // Facettes : chacune restreint, elles se cumulent.
  category: z.enum(CARD_CATEGORIES).optional(),
  archetype: z.string().trim().max(100).optional(),
  attribute: z.string().trim().max(20).optional(),
  race: z.string().trim().max(40).optional(),
  rarity: z.string().trim().max(60).optional(),
  language: z.enum(CARD_LANGUAGES).optional(),
  condition: z.enum(CARD_CONDITIONS).optional(),
  /** Extension d'où vient l'impression possédée. */
  setId: z.string().trim().max(40).optional(),
  firstEdition: z.coerce.boolean().optional(),
  /** Étiquettes personnelles : la carte doit porter TOUTES celles demandées. */
  tagIds: tagIdsSchema.optional(),
  /** Par défaut : par nom. */
  sort: z.enum(['name', 'quantity', 'value', 'newest', 'rarity']).optional(),
});
export type CollectionQueryInput = z.infer<typeof collectionQuerySchema>;

/**
 * Langue dans laquelle on range sa collection. Indépendante de celle de l'interface : on peut
 * lire l'app en français et collectionner en anglais.
 */
export const collectionLanguageSchema = z.object({
  language: z.enum(CARD_LANGUAGES),
  /** Appliquer aussi le choix aux cartes déjà en collection. */
  normalize: z.boolean().default(false),
});
export type CollectionLanguageInput = z.infer<typeof collectionLanguageSchema>;

/** Ce que la normalisation ferait, avant de l'avoir faite. */
export interface CollectionLanguageReportDto {
  target: CardLanguage;
  /** Répartition actuelle, les langues les plus nombreuses d'abord. */
  byLanguage: { language: CardLanguage; piles: number; copies: number }[];
  /** Piles qui changeraient de langue. */
  affected: number;
  /** Piles qui disparaîtraient, absorbées par une pile devenue identique. */
  merged: number;
}

export interface CollectionLanguageResultDto {
  target: CardLanguage;
  retagged: number;
  merged: number;
}

/** État du réglage, et ce que normaliser vers `report.target` coûterait. */
export interface CollectionLanguageStateDto {
  /** Choix explicite, ou `null` tant que personne n'a tranché. */
  language: CardLanguage | null;
  /** Celle qui s'applique aujourd'hui : le choix, sinon la langue de la requête. */
  effective: CardLanguage;
  report: CollectionLanguageReportDto;
}
