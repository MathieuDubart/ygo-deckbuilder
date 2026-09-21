import { z } from 'zod';
import { CARD_LANGUAGES, WISHLIST_PRIORITIES } from '../domain/enums';

export const addWishlistItemSchema = z.object({
  cardId: z.number().int().positive(),
  printId: z.string().optional(),
  deckId: z.string().optional(),
  quantity: z.number().int().min(1).max(3).default(1),
  maxPrice: z.number().nonnegative().max(100000).optional(),
  language: z.enum(CARD_LANGUAGES).optional(),
  priority: z.enum(WISHLIST_PRIORITIES).default('MEDIUM'),
  notes: z.string().max(500).optional(),
});
export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;

export const updateWishlistItemSchema = addWishlistItemSchema.omit({ cardId: true }).partial();
export type UpdateWishlistItemInput = z.infer<typeof updateWishlistItemSchema>;
