import { z } from 'zod';
import type { CardSummaryDto } from './cards';
import type { DeckZone } from '../domain/enums';

export const metaSuggestionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  minCoverage: z.coerce.number().min(0).max(1).default(0),
});
export type MetaSuggestionQuery = z.infer<typeof metaSuggestionQuerySchema>;

export interface MissingCardDto {
  card: CardSummaryDto;
  zone: DeckZone;
  required: number;
  owned: number;
  missing: number;
  /** Prix unitaire le moins cher connu (EUR, Cardmarket). */
  unitPrice: number | null;
}

export interface MetaDeckSuggestionDto {
  metaDeckId: string;
  name: string;
  archetype: string | null;
  tier: number | null;
  /** 0..1 — part des exemplaires requis (main+extra) déjà possédés. */
  coverage: number;
  ownedCopies: number;
  requiredCopies: number;
  missing: MissingCardDto[];
  estimatedCostToComplete: number;
}

export interface CardSuggestionDto {
  card: CardSummaryDto;
  reason: 'SAME_ARCHETYPE' | 'MENTIONED_IN_TEXT' | 'STAPLE';
  ownedQuantity: number;
}

export interface ArchetypeSuggestionDto {
  archetype: string;
  distinctCards: number;
  totalCopies: number;
}

export const importMetaDeckSchema = z.object({
  name: z.string().trim().min(1).max(80),
  archetype: z.string().trim().max(80).optional(),
  tier: z.number().int().min(0).max(5).optional(),
  format: z.enum(['TCG', 'OCG', 'GOAT', 'EDISON', 'CASUAL']).default('TCG'),
  sourceUrl: z.url().optional(),
  ydk: z.string().min(1).max(20000),
});
export type ImportMetaDeckInput = z.infer<typeof importMetaDeckSchema>;
