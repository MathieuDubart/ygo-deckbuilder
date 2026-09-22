import { z } from 'zod';
import type { CardLanguage } from '../domain/enums';
import type { CardSetDto, CardSummaryDto } from './cards';

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
}
