import { z } from 'zod';
import { CARD_CATEGORIES, CARD_CONDITIONS, CARD_LANGUAGES } from '../domain/enums';
import { paginationSchema } from './pagination';
import { tagIdsSchema } from './tags';

export const addCollectionItemSchema = z.object({
  cardId: z.number().int().positive(),
  printId: z.string().optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  condition: z.enum(CARD_CONDITIONS).default('NEAR_MINT'),
  language: z.enum(CARD_LANGUAGES).default('FR'),
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
  language: z.enum(CARD_LANGUAGES).default('FR'),
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
