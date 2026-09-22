export type Zone = 'MAIN' | 'EXTRA' | 'SIDE';

/** Une decklist de tournoi, IDs déjà résolus vers la carte principale (sans artworks alternatifs). */
export interface TournamentList {
  id: number;
  name: string;
  main: number[];
  extra: number[];
  side: number[];
}

export interface CardStat {
  /** Part des listes qui jouent la carte (main ou extra) */
  share: number;
  /** Nombre moyen d'exemplaires quand elle est jouée */
  avgCopies: number;
}

export interface TemplateCard {
  cardId: number;
  zone: Zone;
  quantity: number;
  /** Part des listes de l'archétype qui la jouent */
  inclusion: number;
}

/** Liste "consensus" d'un archétype + ses cartes flex (jouées par une partie des listes). */
export interface DeckTemplate {
  cards: TemplateCard[];
  flex: TemplateCard[];
  mainSize: number;
}

export interface Cluster {
  name: string;
  variants: string[];
  lists: TournamentList[];
  share: number;
  tier: number;
}
