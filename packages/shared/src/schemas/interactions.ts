import type { CardSummaryDto } from './cards';

export const INTERACTION_VERBS = [
  'SEARCH',
  'RECOVER',
  'SPECIAL_SUMMON',
  'SUMMON_EXTRA',
  'SEND_GY',
  'MATERIAL',
  'MENTION',
] as const;
export type InteractionVerb = (typeof INTERACTION_VERBS)[number];

/** Un lien entre la carte consultée et d'autres cartes du catalogue. */
export interface CardInteractionGroupDto {
  /** OUT = ce que fait la carte · IN = ce que les autres cartes font avec elle */
  direction: 'OUT' | 'IN';
  verb: InteractionVerb;
  /** Cible lue dans le texte (OUT) : « Syntoniseur LUMIÈRE de niveau 1 »… */
  target: string | null;
  /** DIRECT = cite un nom / archétype · PRECISE = filtre serré (niveau, attribut, type…) */
  precision: 'DIRECT' | 'PRECISE';
  /** Cartes concernées (les tiennes d'abord, puis les plus jouées) */
  cards: CardSummaryDto[];
  total: number;
}

export interface CardInteractionsDto {
  cardId: number;
  groups: CardInteractionGroupDto[];
  /** Effets trop larges pour lister des cartes (« 1 monstre de ton cimetière ») */
  generic: { verb: InteractionVerb; target: string }[];
  /** Nombre de cartes de la collection reliées à celle-ci */
  ownedLinked: number;
  /** false tant que l'index des interactions n'a pas été construit */
  indexed: boolean;
}
