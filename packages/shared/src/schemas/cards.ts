import { z } from 'zod';
import {
  CARD_CATEGORIES,
  PRODUCT_KINDS,
  type CardCategory,
  type ProductKind,
} from '../domain/enums';
import { paginationSchema } from './pagination';

export const cardSearchSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CARD_CATEGORIES).optional(),
  archetype: z.string().trim().max(100).optional(),
  attribute: z.string().trim().max(20).optional(),
  race: z.string().trim().max(40).optional(),
  levelMin: z.coerce.number().int().min(0).max(13).optional(),
  levelMax: z.coerce.number().int().min(0).max(13).optional(),
  setName: z.string().trim().max(200).optional(),
  /** Ne renvoyer que les cartes possédées par l'utilisateur connecté. */
  owned: z.coerce.boolean().optional(),
  /** Par défaut : pertinence si `q` est renseigné, sinon nom. */
  sort: z.enum(['relevance', 'name', 'atk', 'def', 'level', 'newest']).optional(),
});
export type CardSearchInput = z.infer<typeof cardSearchSchema>;

export interface CardPrintDto {
  id: string;
  setCode: string | null;
  setName: string;
  printCode: string;
  rarity: string;
  rarityCode: string | null;
  price: number | null;
}

export interface CardSummaryDto {
  id: number;
  name: string;
  category: CardCategory;
  type: string;
  frameType: string;
  archetype: string | null;
  attribute: string | null;
  race: string | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  /** Pleine résolution (≈ 421×614) : l'optimiseur d'images du front la redimensionne. */
  imageUrl: string | null;
  imageUrlSmall: string | null;
  isExtraDeck: boolean;
  banTcg: string | null;
  priceCardmarket: number | null;
  ownedQuantity?: number;
}

export interface CardDetailDto extends CardSummaryDto {
  desc: string;
  linkVal: number | null;
  linkMarkers: string[];
  scale: number | null;
  banOcg: string | null;
  prints: CardPrintDto[];
}

export const setSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(PRODUCT_KINDS).optional(),
});
export type SetSearchInput = z.infer<typeof setSearchSchema>;

export interface CardSetDto {
  id: string;
  name: string;
  code: string | null;
  tcgDate: string | null;
  kind: ProductKind;
  /** Meilleur visuel : HD (Yugipedia), sinon YGOPRODeck, sinon l'illustration de sa première carte. */
  imageUrl: string | null;
  /** Visuel de secours si le premier ne charge pas. */
  fallbackImageUrl: string | null;
  /** Nombre de cartes distinctes réellement connues dans ce produit. */
  cardCount: number;
}
