import { z } from 'zod';
import {
  PRODUCT_KINDS,
  RELEASE_PROGRESS_FILTERS,
  RELEASE_STATUSES,
  type ReleaseStatus,
} from '../domain/enums';
import { paginationSchema } from './pagination';
import { tagIdsSchema } from './tags';
import type { CardSetDto, CardSummaryDto } from './cards';
import type { FacetValueDto } from './facets';

export const releaseQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(PRODUCT_KINDS).optional(),
  status: z.enum(RELEASE_STATUSES).optional(),
  progress: z.enum(RELEASE_PROGRESS_FILTERS).optional(),
  /** Année de sortie (TCG). */
  year: z.coerce.number().int().min(1999).max(2100).optional(),
  tagIds: tagIdsSchema.optional(),
  /** N'afficher que les extensions dont on possède le produit scellé. */
  ownedProduct: z.coerce.boolean().optional(),
  /** Par défaut : les sorties les plus récentes d'abord. */
  sort: z.enum(['date', 'progress', 'name', 'cards']).optional(),
});
export type ReleaseQueryInput = z.infer<typeof releaseQuerySchema>;

/**
 * Avancement sur une extension, sous ses deux lectures :
 *  - collectionneur : l'impression exacte (`ownedPrints` sur `prints`) ;
 *  - joueur : la carte, peu importe l'édition où on la possède (`ownedCards` sur `cards`).
 * Les deux sont calculées côté serveur ; l'interface ne fait que choisir laquelle montrer.
 */
export interface ReleaseProgressDto {
  /** Impressions distinctes connues dans l'extension (une carte peut en avoir plusieurs). */
  prints: number;
  /** Cartes distinctes connues dans l'extension. */
  cards: number;
  /** Impressions de l'extension présentes dans la collection. */
  ownedPrints: number;
  /** Cartes de l'extension possédées, toutes éditions confondues. */
  ownedCards: number;
  /** Exemplaires rattachés à une impression de cette extension. */
  copies: number;
}

export interface ReleaseDto {
  set: CardSetDto;
  status: ReleaseStatus;
  /** Jours avant la sortie (statut `UPCOMING`), sinon null. */
  daysUntil: number | null;
  progress: ReleaseProgressDto;
  /** Produit scellé de cette extension présent dans la collection. */
  ownedProduct: boolean;
  /** Valeur estimée des cartes de l'extension déjà possédées. */
  ownedValue: number;
  /** Prix de rachat des impressions qui manquent encore. */
  missingValue: number;
  tagIds: string[];
}

/** Une impression à tirer dans l'extension, et où on en est dessus. */
export interface ReleaseCardDto {
  card: CardSummaryDto;
  printId: string;
  printCode: string;
  rarity: string;
  rarityCode: string | null;
  price: number | null;
  /** Exemplaires possédés de cette impression précise. */
  owned: number;
  /** Exemplaires de la même carte possédés via une autre impression. */
  ownedElsewhere: number;
}

export interface ReleaseRarityDto {
  rarity: string;
  prints: number;
  ownedPrints: number;
}

export interface ReleaseDetailDto extends ReleaseDto {
  cards: ReleaseCardDto[];
  /** Avancement par rareté, de la plus courante à la plus rare. */
  rarities: ReleaseRarityDto[];
}

/** Ce qu'on met en avant en haut de l'onglet : ce qui arrive, et ce qui vient de sortir. */
export interface ReleaseSpotlightDto {
  upcoming: ReleaseDto[];
  recent: ReleaseDto[];
}

export interface ReleaseFacetsDto {
  kinds: FacetValueDto[];
  statuses: FacetValueDto[];
  years: FacetValueDto[];
}
