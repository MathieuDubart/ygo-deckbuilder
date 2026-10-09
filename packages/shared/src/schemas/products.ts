import { z } from 'zod';
import { PRODUCT_KINDS, type CardLanguage } from '../domain/enums';
import type { CardSetDto, CardSummaryDto } from './cards';
import { tagIdsSchema } from './tags';

export const ownedProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(PRODUCT_KINDS).optional(),
  /** Étiquettes posées sur l'extension du produit. */
  tagIds: tagIdsSchema.optional(),
  /** Ne garder que les produits encore complets (toutes leurs cartes en collection). */
  complete: z.coerce.boolean().optional(),
  /** Par défaut : les derniers ajoutés d'abord. */
  sort: z.enum(['added', 'name', 'date', 'completeness']).optional(),
});
export type OwnedProductsQueryInput = z.infer<typeof ownedProductsQuerySchema>;

export const removeProductSchema = z.object({
  /** Retire aussi de la collection les cartes apportées par ce produit */
  removeCards: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type RemoveProductInput = z.infer<typeof removeProductSchema>;

/** Produit (structure deck, tin…) ajouté à la collection. */
export interface OwnedProductDto {
  id: string;
  set: CardSetDto;
  /** Nombre de produits identiques */
  copies: number;
  language: CardLanguage;
  addedAt: string;
  /** Cartes dans UN produit (exemplaires) */
  totalCards: number;
  distinctCards: number;
  /** Quantités lues dans la liste officielle (Yugipedia) ; sinon 1 exemplaire par carte */
  quantitiesVerified: boolean;
  /** 0..1 — part des exemplaires du produit encore présents dans la collection */
  completeness: number;
  /** Exemplaires manquants pour reconstituer tous les produits */
  missingCopies: number;
  /** Produit jouable tel quel (structure deck, starter…) → guide de jeu */
  isDeck: boolean;
  /** Étiquettes personnelles posées sur l'extension de ce produit. */
  tagIds: string[];
}

export interface OwnedProductCardDto {
  card: CardSummaryDto;
  printCode: string;
  rarity: string;
  /** Exemplaires dans UN produit */
  quantity: number;
  /** Exemplaires pour reconstituer tous les produits (quantity × copies) */
  needed: number;
  /** Exemplaires possédés (toutes éditions confondues) */
  owned: number;
  zone: 'MAIN' | 'EXTRA';
}

export interface OwnedProductDetailDto extends OwnedProductDto {
  cards: OwnedProductCardDto[];
}

export interface ImportSetResultDto {
  productId: string;
  set: string;
  cardsAdded: number;
  copiesAdded: number;
  quantitiesVerified: boolean;
  /** Decks posés dans « Mes decks » au passage, un par liste officielle du produit. */
  decksCreated: { id: string; name: string }[];
}
