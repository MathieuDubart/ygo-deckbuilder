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

/**
 * Un deck officiel du produit, et son état dans « Mes decks ».
 *
 * `deckId` est la seule chose qui distingue « pas encore monté » de « déjà là » : un deck
 * supprimé par erreur repasse à null, et le bouton de remontage retrouve alors son utilité.
 */
export interface ProductOfficialDeckDto {
  /** Identifiant de la liste officielle, pas du deck. */
  listId: string;
  /** Nom du deck tel que l'assembleur le pose, dans la langue de la requête. */
  name: string;
  /** Boîtes dont la liste est montée : 3 pour un structure deck, 1 pour tout le reste. */
  copies: number;
  /** Le deck dans « Mes decks », s'il y est encore. */
  deckId: string | null;
}

export interface OwnedProductDetailDto extends OwnedProductDto {
  cards: OwnedProductCardDto[];
  /** Les decks officiels de ce produit. Vide si aucune liste n'est connue (un booster). */
  officialDecks: ProductOfficialDeckDto[];
}

export const rebuildProductDecksSchema = z.object({
  /**
   * Remonter aussi les decks encore présents : leur contenu est remplacé par celui que
   * l'assembleur produit aujourd'hui. Sans ça, seuls les decks manquants sont reposés.
   */
  force: z.boolean().default(false),
});
export type RebuildProductDecksInput = z.infer<typeof rebuildProductDecksSchema>;

export interface RebuildProductDecksResultDto {
  /** Decks reposés dans « Mes decks ». */
  created: { id: string; name: string }[];
  /** Decks déjà présents dont le contenu a été remplacé. */
  rebuilt: { id: string; name: string }[];
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
