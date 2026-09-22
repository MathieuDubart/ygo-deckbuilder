import { z } from 'zod';
import type { CardSummaryDto } from './cards';

/**
 * Simulateur de duel : le moteur d'EDOPro (ygopro-core + scripts de cartes ProjectIgnis) tourne
 * côté API ; le client affiche l'état du duel et répond aux choix demandés par le moteur.
 * Vue toujours du point de vue de l'utilisateur : joueur 0 = toi, joueur 1 = l'adversaire.
 */

/** Qui joue l'adversaire : personne (il ne fait rien), toi (tu choisis ses réponses), un bot (à venir). */
export const DUEL_OPPONENT_CONTROLS = ['PASSIVE', 'ME'] as const;
export type DuelOpponentControl = (typeof DUEL_OPPONENT_CONTROLS)[number];

export const DUEL_SETUP_LOCATIONS = [
  'MZONE',
  'SZONE',
  'FZONE',
  'HAND',
  'GRAVE',
  'BANISHED',
] as const;
export type DuelSetupLocation = (typeof DUEL_SETUP_LOCATIONS)[number];

export const DUEL_SETUP_POSITIONS = ['ATTACK', 'DEFENSE', 'SET'] as const;
export type DuelSetupPosition = (typeof DUEL_SETUP_POSITIONS)[number];

/** Carte placée en face avant le début du duel (plateau de test). */
export const duelBoardCardSchema = z.object({
  cardId: z.number().int().positive(),
  location: z.enum(DUEL_SETUP_LOCATIONS),
  position: z.enum(DUEL_SETUP_POSITIONS).default('ATTACK'),
  /** Zone 0–4 (gauche → droite) pour MZONE / SZONE ; première libre si absente */
  zone: z.number().int().min(0).max(4).optional(),
});
export type DuelBoardCardInput = z.infer<typeof duelBoardCardSchema>;

export const createDuelSchema = z.object({
  deckId: z.string().min(1),
  /** true = tu commences */
  goingFirst: z.boolean().default(true),
  /** Cartes du deck imposées dans la main de départ (tester une main précise) */
  openingHand: z.array(z.number().int().positive()).max(6).default([]),
  startingLP: z.number().int().min(100).max(99_999).default(8000),
  opponent: z
    .object({
      control: z.enum(DUEL_OPPONENT_CONTROLS).default('PASSIVE'),
      /** Deck adverse (sinon une copie du tien, qui sert seulement à piocher) */
      deckId: z.string().optional(),
      /** Plateau adverse de départ */
      board: z.array(duelBoardCardSchema).max(30).default([]),
    })
    .default({ control: 'PASSIVE', board: [] }),
});
export type CreateDuelInput = z.infer<typeof createDuelSchema>;

export const DUEL_LOCATIONS = [
  'DECK',
  'HAND',
  'MZONE',
  'SZONE',
  'GRAVE',
  'BANISHED',
  'EXTRA',
  'OVERLAY',
] as const;
export type DuelLocation = (typeof DUEL_LOCATIONS)[number];

export type DuelPosition = 'ATK' | 'DEF' | 'FD_ATK' | 'FD_DEF';

/** Référence d'une carte dans le duel (point de vue de l'utilisateur). */
export interface DuelCardRef {
  /** 0 = toi, 1 = l'adversaire */
  controller: 0 | 1;
  location: DuelLocation;
  sequence: number;
  /** Passcode, 0 si la carte est cachée */
  code: number;
}

export interface DuelCardDto extends DuelCardRef {
  position: DuelPosition | null;
  attack: number | null;
  defense: number | null;
  level: number | null;
  rank: number | null;
  link: number | null;
  /** Codes des Matériels Xyz */
  overlays: number[];
  counters: number;
}

export interface DuelPlayerDto {
  lp: number;
  deckCount: number;
  extraCount: number;
  hand: DuelCardDto[];
  /** 7 cases : 0–4 Zones Monstre Principales, 5–6 Zones Monstre Extra */
  monsters: (DuelCardDto | null)[];
  /** 6 cases : 0–4 Zones Magie & Piège (0 et 4 = Zones Pendule), 5 = Zone Terrain */
  spells: (DuelCardDto | null)[];
  grave: DuelCardDto[];
  banished: DuelCardDto[];
  /** Extra Deck (le tien, ou celui de l'adversaire si tu le contrôles) */
  extra: DuelCardDto[];
}

export const DUEL_PHASES = ['DRAW', 'STANDBY', 'MAIN1', 'BATTLE', 'MAIN2', 'END'] as const;
export type DuelPhase = (typeof DUEL_PHASES)[number];

/** Action proposée pendant une Main Phase ou la Battle Phase. */
export interface DuelActionDto {
  kind: 'SUMMON' | 'SPSUMMON' | 'REPOSITION' | 'SET_MONSTER' | 'SET_SPELL' | 'ACTIVATE' | 'ATTACK';
  /** Index dans la liste de ce type (renvoyé tel quel dans la réponse) */
  index: number;
  card: DuelCardRef;
  /** Texte de l'effet activé, quand la carte en a plusieurs */
  description: string | null;
  /** Attaque directe possible */
  direct?: boolean;
}

export interface DuelChoiceCard {
  index: number;
  card: DuelCardRef;
  description?: string | null;
  /** Valeur pour les sélections à somme (Niveaux…) */
  value?: number;
}

export type DuelPromptDto = { id: number; player: 0 | 1; hint: string | null } & (
  | { kind: 'IDLE'; actions: DuelActionDto[]; canBattle: boolean; canEnd: boolean }
  | { kind: 'BATTLE'; actions: DuelActionDto[]; canMain2: boolean; canEnd: boolean }
  | { kind: 'CHAIN'; options: DuelChoiceCard[]; forced: boolean }
  | { kind: 'YESNO'; text: string; card: DuelCardRef | null }
  | { kind: 'OPTION'; options: { index: number; text: string }[] }
  | {
      kind: 'SELECT_CARDS';
      mode: 'CARD' | 'TRIBUTE' | 'SUM';
      cards: DuelChoiceCard[];
      /** Toujours sélectionnées (sélection à somme) */
      mustCards: DuelChoiceCard[];
      min: number;
      max: number;
      /** Somme visée (mode SUM) */
      sum: number | null;
      cancelable: boolean;
    }
  | {
      kind: 'SELECT_UNSELECT';
      selectable: DuelChoiceCard[];
      unselectable: DuelChoiceCard[];
      canFinish: boolean;
      cancelable: boolean;
      min: number;
      max: number;
    }
  | {
      kind: 'PLACE';
      zones: { controller: 0 | 1; location: 'MZONE' | 'SZONE'; sequence: number }[];
      count: number;
      /** Zones à rendre inutilisables plutôt qu'à occuper */
      disable: boolean;
    }
  | { kind: 'POSITION'; code: number; positions: DuelPosition[] }
  | { kind: 'ANNOUNCE_NUMBER'; values: number[] }
  | { kind: 'ANNOUNCE_RACE' | 'ANNOUNCE_ATTRIBUTE'; choices: string[]; count: number }
  | { kind: 'ANNOUNCE_CARD' }
  | { kind: 'SORT'; cards: DuelChoiceCard[] }
);
export type DuelPromptKind = DuelPromptDto['kind'];

export const duelResponseSchema = z.object({
  promptId: z.number().int(),
  /** Action (IDLE / BATTLE) : type + index, ou changement de phase */
  action: z
    .object({
      kind: z.enum([
        'SUMMON',
        'SPSUMMON',
        'REPOSITION',
        'SET_MONSTER',
        'SET_SPELL',
        'ACTIVATE',
        'ATTACK',
      ]),
      index: z.number().int().min(0),
    })
    .optional(),
  phase: z.enum(['BATTLE', 'MAIN2', 'END']).optional(),
  /** CHAIN / OPTION / SELECT_UNSELECT / ANNOUNCE_NUMBER : index ; null = passer / annuler */
  index: z.number().int().min(0).nullable().optional(),
  /** SELECT_CARDS : indices ; null = annuler */
  indices: z.array(z.number().int().min(0)).max(60).nullable().optional(),
  yes: z.boolean().optional(),
  zones: z
    .array(
      z.object({
        controller: z.union([z.literal(0), z.literal(1)]),
        location: z.enum(['MZONE', 'SZONE']),
        sequence: z.number().int().min(0).max(7),
      }),
    )
    .max(8)
    .optional(),
  position: z.enum(['ATK', 'DEF', 'FD_ATK', 'FD_DEF']).optional(),
  values: z.array(z.string()).max(10).optional(),
  cardId: z.number().int().positive().optional(),
  order: z.array(z.number().int().min(0)).max(60).nullable().optional(),
});
export type DuelResponseInput = z.infer<typeof duelResponseSchema>;

/** Événement du journal (textes composés côté client, dans sa langue). */
export type DuelEventDto = { seq: number; turn: number } & (
  | { kind: 'TURN'; player: 0 | 1 }
  | { kind: 'PHASE'; phase: DuelPhase }
  | { kind: 'DRAW'; player: 0 | 1; count: number; codes: number[] }
  | {
      kind: 'SUMMON';
      player: 0 | 1;
      code: number;
      how: 'NORMAL' | 'SPECIAL' | 'FLIP';
    }
  | { kind: 'SET'; player: 0 | 1; code: number }
  | { kind: 'ACTIVATE'; player: 0 | 1; code: number; chainLink: number; description: string | null }
  | { kind: 'CHAIN_NEGATED'; chainLink: number }
  | { kind: 'MOVE'; player: 0 | 1; code: number; from: DuelLocation; to: DuelLocation }
  | { kind: 'ATTACK'; player: 0 | 1; code: number; target: number | null }
  | { kind: 'DAMAGE'; player: 0 | 1; amount: number; cost: boolean }
  | { kind: 'RECOVER'; player: 0 | 1; amount: number }
  | { kind: 'COIN'; player: 0 | 1; results: boolean[] }
  | { kind: 'DICE'; player: 0 | 1; results: number[] }
  | { kind: 'WIN'; winner: 0 | 1 | null; reason: string | null }
);

export interface DuelStateDto {
  id: string;
  turn: number;
  /** Joueur dont c'est le tour */
  turnPlayer: 0 | 1;
  phase: DuelPhase;
  players: [DuelPlayerDto, DuelPlayerDto];
  /** Chaîne en cours (maillon 1 en premier) */
  chain: { card: DuelCardRef; description: string | null }[];
  prompt: DuelPromptDto | null;
  /** Nouveaux événements depuis la dernière réponse (le client les accumule) */
  events: DuelEventDto[];
  /** Cartes citées (passcode → résumé) : visuels et noms dans la langue de l'utilisateur */
  cards: Record<string, CardSummaryDto>;
  opponentControl: DuelOpponentControl;
  finished: { winner: 0 | 1 | null; reason: string | null } | null;
}

/** Données du moteur : prêtes, en cours de téléchargement ou indisponibles. */
export interface DuelEngineStatusDto {
  ready: boolean;
  downloading: boolean;
  cards: number;
  scripts: number;
  updatedAt: string | null;
  error: string | null;
}
