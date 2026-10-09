import { z } from 'zod';
import { DECK_FORMATS, DECK_ZONES, type DeckFormat, type DeckZone } from '../domain/enums';
import type { DeckIssue } from '../domain/deck-rules';
import type { CardSummaryDto } from './cards';
import type { DeckScoreDto } from './suggestions';
import { tagIdsSchema } from './tags';

/** Tris de la liste des decks. Le défaut, `updated`, met en tête ce qu'on vient de toucher. */
export const DECK_SORTS = ['updated', 'created', 'name', 'size', 'strength'] as const;
export type DeckSort = (typeof DECK_SORTS)[number];

/**
 * Filtres de « Mes decks ». Mêmes outils que la collection : une recherche, des étiquettes
 * qui se cumulent (ET, pas OU) et un tri.
 */
export const deckQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tagIds: tagIdsSchema.optional(),
  format: z.enum(DECK_FORMATS).optional(),
  sort: z.enum(DECK_SORTS).optional(),
});
export type DeckQueryInput = z.infer<typeof deckQuerySchema>;

export const deckCardSchema = z.object({
  cardId: z.number().int().positive(),
  zone: z.enum(DECK_ZONES),
  quantity: z.number().int().min(1).max(3),
});
export type DeckCardInput = z.infer<typeof deckCardSchema>;

export const createDeckSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).optional(),
  format: z.enum(DECK_FORMATS).default('TCG'),
  isPublic: z.boolean().default(false),
  cards: z.array(deckCardSchema).max(90).default([]),
});
export type CreateDeckInput = z.infer<typeof createDeckSchema>;

export const updateDeckSchema = createDeckSchema.partial();
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;

export const importYdkSchema = z.object({
  name: z.string().trim().min(1).max(80),
  format: z.enum(DECK_FORMATS).default('TCG'),
  content: z.string().min(1).max(20000),
});
export type ImportYdkInput = z.infer<typeof importYdkSchema>;

export interface DeckCardDto {
  cardId: number;
  zone: DeckZone;
  quantity: number;
  ownedQuantity: number;
  card: CardSummaryDto;
}

export interface DeckDto {
  id: string;
  name: string;
  description: string | null;
  format: DeckFormat;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  cards: DeckCardDto[];
  issues: DeckIssue[];
}

export interface DeckListItemDto {
  id: string;
  name: string;
  format: DeckFormat;
  updatedAt: string;
  mainCount: number;
  extraCount: number;
  sideCount: number;
  coverImageUrl: string | null;
  /** Étiquettes posées par l'utilisateur. */
  tagIds: string[];
  /** Monté depuis la liste officielle d'un produit, et non écrit à la main. */
  fromProduct: boolean;
  /**
   * Solidité du deck, 0..100, la même note que les decks suggérés. Null quand le deck est
   * trop incomplet pour qu'une note veuille dire quoi que ce soit.
   */
  strength: number | null;
  /** Style déduit du contenu, ou null si le deck est trop incomplet. */
  style: DeckStyle | null;
}

/**
 * Les cinq formes de jeu. Un deck n'est pas « fort » dans l'absolu : il l'est contre
 * certaines formes et pas contre d'autres, et c'est ce que les pronostics disent.
 */
export const DECK_STYLES = ['COMBO', 'MIDRANGE', 'CONTROL', 'STUN', 'BEATDOWN'] as const;
export type DeckStyle = (typeof DECK_STYLES)[number];

export const MATCHUP_VERDICTS = ['GOOD', 'EVEN', 'BAD'] as const;
export type MatchupVerdict = (typeof MATCHUP_VERDICTS)[number];

/** Pourquoi le pronostic est ce qu'il est — une clé, le texte vit côté client. */
export const MATCHUP_REASONS = [
  'HAND_TRAPS',
  'NO_HAND_TRAPS',
  'BREAKERS',
  'NO_BREAKERS',
  'LOCK',
  'FRAGILE_SETUP',
  'DISRUPTION',
  'NO_DISRUPTION',
  'RESILIENCE',
  'BALANCED',
] as const;
export type MatchupReason = (typeof MATCHUP_REASONS)[number];

export interface MatchupDto {
  /** Le style affronté. */
  against: DeckStyle;
  /** Nom du deck du meta quand le pronostic vise un adversaire réel, sinon null. */
  opponent: string | null;
  verdict: MatchupVerdict;
  reason: MatchupReason;
  /** −1..1 */
  edge: number;
}

/** Ce qu'un deck sait faire, en six axes de 0 à 1. */
export interface DeckProfileDto {
  style: DeckStyle;
  setup: number;
  disruption: number;
  handInteraction: number;
  breaking: number;
  lock: number;
  resilience: number;
  consistency: number;
}

/** Force d'un deck : sa note, sa forme, et contre quoi elle vaut. */
export interface DeckStrengthDto {
  score: DeckScoreDto;
  profile: DeckProfileDto;
  /** Du plus favorable au moins favorable. Nommé quand le meta est connu. */
  matchups: MatchupDto[];
}
