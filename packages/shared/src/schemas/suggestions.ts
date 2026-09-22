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
  /** "tournaments" (calculé) ou "manual" (importé) */
  source: string | null;
  /** Nombre de listes de tournoi derrière cet archétype */
  listCount: number;
  /** Part du meta récent (0..1) */
  share: number | null;
  variants: string[];
  coverImageUrl: string | null;
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

export const GENERATION_MODES = ['META', 'OWNED'] as const;
export type GenerationMode = (typeof GENERATION_MODES)[number];

export const generateFromMetaSchema = z.object({
  mode: z.enum(GENERATION_MODES).default('OWNED'),
});
export type GenerateFromMetaInput = z.infer<typeof generateFromMetaSchema>;

export const generateFromArchetypeSchema = z.object({
  archetype: z.string().trim().min(1).max(100),
});
export type GenerateFromArchetypeInput = z.infer<typeof generateFromArchetypeSchema>;

/**
 * Origine d'une carte dans un deck généré :
 *  CORE = liste type de l'archétype · FLEX = jouée par une partie des listes
 *  STAPLE = carte générique du meta · ARCHETYPE = carte de l'archétype · SUPPORT = la cite
 */
export type GeneratedCardSource = 'CORE' | 'FLEX' | 'STAPLE' | 'ARCHETYPE' | 'SUPPORT';

export interface GeneratedDeckCardDto {
  card: CardSummaryDto;
  zone: DeckZone;
  quantity: number;
  owned: number;
  source: GeneratedCardSource;
  /** Part des listes de tournoi de l'archétype qui jouent la carte */
  inclusion: number | null;
}

export interface GeneratedDeckDto {
  name: string;
  mode: GenerationMode | 'ARCHETYPE';
  metaDeckId: string | null;
  archetype: string | null;
  cards: GeneratedDeckCardDto[];
  counts: { MAIN: number; EXTRA: number; SIDE: number };
  missingCopies: number;
  /** Coût estimé des exemplaires manquants (Cardmarket, €) */
  missingCost: number;
  /** Main deck ≥ 40 cartes */
  complete: boolean;
  notes: string[];
}
