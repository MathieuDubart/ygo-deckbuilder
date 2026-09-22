import { z } from 'zod';
import { DECK_ZONES } from '../domain/enums';
import type { CardSummaryDto } from './cards';

/** Demande de guide de jeu pour une liste (deck généré ou deck de l'utilisateur). */
export const deckGuideRequestSchema = z.object({
  name: z.string().trim().max(120).optional(),
  cards: z
    .array(
      z.object({
        cardId: z.number().int().positive(),
        zone: z.enum(DECK_ZONES),
        quantity: z.number().int().min(1).max(3),
      }),
    )
    .min(1)
    .max(120),
  /** false = guide calculé uniquement (sans modèle de langage) */
  ai: z.boolean().default(true),
});
export type DeckGuideRequest = z.infer<typeof deckGuideRequestSchema>;

export const GUIDE_ROLES = [
  'STARTER',
  'SEARCHER',
  'EXTENDER',
  'HAND_TRAP',
  'INTERRUPTION',
  'REMOVAL',
  'DRAW',
  'RECOVERY',
  'FUSION_ENABLER',
  'RITUAL_ENABLER',
  'BOSS',
] as const;
export type GuideRole = (typeof GUIDE_ROLES)[number];

export interface GuideStatDto {
  label: string;
  value: string;
  hint: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

export interface GuideKeyCardDto {
  cardId: number;
  roles: GuideRole[];
  why: string;
}

export interface GuideComboDto {
  title: string;
  handIds: number[];
  steps: { text: string; cardIds: number[] }[];
  endBoardIds: number[];
}

/**
 * Guide de jeu d'un deck : style, plan, cartes clés, combos, erreurs à éviter.
 * Calculé à partir des effets des cartes, éventuellement reformulé par une IA.
 */
export interface DeckGuideDto {
  /** RULES = calculé ; AI = texte rédigé par un modèle à partir du calcul */
  source: 'RULES' | 'AI';
  model: string | null;
  /** Une IA est configurée sur le serveur */
  aiAvailable: boolean;
  /** Raison de l'échec quand l'IA était demandée mais n'a pas pu rédiger le guide */
  aiError: string | null;
  /** false = effets des cartes illisibles : guide réduit (pas de combos ni de stats) */
  readable: boolean;
  summary: string;
  styles: string[];
  stats: GuideStatDto[];
  gamePlan: string[];
  keyCards: GuideKeyCardDto[];
  combos: GuideComboDto[];
  goingFirst: string[];
  goingSecond: string[];
  mistakes: string[];
  /** Conseils en plus (IA) */
  tips: string[];
  /** Cartes citées (id → résumé) pour afficher les visuels */
  cards: Record<string, CardSummaryDto>;
}
