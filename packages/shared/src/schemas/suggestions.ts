import { z } from 'zod';
import type { CardSetDto, CardSummaryDto } from './cards';
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
 *  FILLER = complément générique pour atteindre un deck jouable
 */
export type GeneratedCardSource = 'CORE' | 'FLEX' | 'STAPLE' | 'ARCHETYPE' | 'SUPPORT' | 'FILLER';

/** Note de solidité d'un deck généré (heuristique lisible, cf. scoreDeck côté API). */
export interface DeckScoreDto {
  /** 0..100 */
  score: number;
  /** Part du main deck tenue par le moteur (archétype, liste type, support) */
  engineShare: number;
  /** Nombre de staples du meta dans le main */
  staples: number;
  /** Part des cartes moteur jouées en 3 exemplaires */
  consistency: number;
  /** Part du main complétée avec des cartes génériques */
  fillerShare: number;
  /** Proximité de la liste de tournoi (0..1) si basé sur un deck du meta */
  metaCoverage: number | null;
  /** 0..1 — synergie : cartes qui s'appellent entre elles, starters, Extra Deck invocable */
  synergy: number | null;
  /** Exemplaires de cartes qui lancent le jeu seules */
  starters: number | null;
  /** 40 cartes, légal, un vrai moteur et assez de starters */
  playable: boolean;
}

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
  score: DeckScoreDto;
  notes: string[];
}

/** Deck complet et jouable proposé automatiquement à partir de la collection. */
export interface PlayableDeckDto {
  /** Pour ouvrir l'aperçu : deck du meta (mode "avec mes cartes") ou archétype de la collection */
  target:
    | { kind: 'meta'; metaDeckId: string; name: string }
    | { kind: 'official'; productDeckId: string; name: string }
    | { kind: 'archetype'; archetype: string };
  name: string;
  archetype: string | null;
  /** Tier du deck meta dont il s'inspire, s'il y en a un */
  tier: number | null;
  score: DeckScoreDto;
  counts: { MAIN: number; EXTRA: number; SIDE: number };
  /** Cartes phares du moteur (pour l'illustration) */
  highlights: CardSummaryDto[];
}

export const OFFICIAL_DECK_KINDS = ['STRUCTURE', 'STARTER', 'BOX'] as const;
export type OfficialDeckKind = (typeof OFFICIAL_DECK_KINDS)[number];

export const officialDeckQuerySchema = z.object({
  /** Filtre par type de produit (coffrets = decks de coffrets comme Legendary Decks) */
  kind: z.enum(OFFICIAL_DECK_KINDS).optional(),
  minCoverage: z.coerce.number().min(0).max(1).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type OfficialDeckQuery = z.infer<typeof officialDeckQuerySchema>;

/**
 * Deck préconstruit officiel (structure deck, starter, deck d'un coffret) et ce que la
 * collection en couvre.
 */
export interface OfficialDeckSuggestionDto {
  productDeckId: string;
  /** Nom du deck dans le produit (« Yusei Deck »), null = le produit est un seul deck */
  deckName: string | null;
  /** Catégorie pour le filtre (un produit à plusieurs decks = coffret) */
  kind: OfficialDeckKind;
  product: CardSetDto;
  archetype: string | null;
  coverage: number;
  ownedCopies: number;
  requiredCopies: number;
  estimatedCostToComplete: number;
  /** Le produit est dans la collection */
  productOwned: boolean;
}
