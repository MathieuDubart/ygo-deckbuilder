import { z } from 'zod';
import { CARD_CONDITIONS, CARD_LANGUAGES } from '../domain/enums';
import { paginationSchema } from './pagination';

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
});
export type CollectionQueryInput = z.infer<typeof collectionQuerySchema>;
