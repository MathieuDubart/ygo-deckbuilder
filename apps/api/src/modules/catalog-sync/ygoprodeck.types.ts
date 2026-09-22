/** Sous-ensemble typé des réponses de l'API YGOPRODeck v7 (https://ygoprodeck.com/api-guide/). */

export interface YgoCardSet {
  set_name: string;
  set_code: string; // code d'impression complet, ex: "LOB-EN001"
  set_rarity: string;
  set_rarity_code?: string;
  set_price?: string;
}

export interface YgoCard {
  id: number;
  name: string;
  type: string;
  frameType: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string;
  linkval?: number;
  linkmarkers?: string[];
  scale?: number;
  card_sets?: YgoCardSet[];
  card_images?: { id: number; image_url: string; image_url_small: string }[];
  card_prices?: { cardmarket_price?: string; tcgplayer_price?: string }[];
  banlist_info?: { ban_tcg?: string; ban_ocg?: string };
  misc_info?: { formats?: string[]; tcg_date?: string; views?: number }[];
}

export interface YgoSetInfo {
  set_name: string;
  set_code: string; // préfixe, ex: "LOB"
  num_of_cards?: number;
  tcg_date?: string;
  set_image?: string;
}

export interface YgoDbVersion {
  database_version: string;
  last_update: string;
}

/** Deck de la base YGOPRODeck (getDecks.php). Les listes sont des tableaux JSON sérialisés en string. */
export interface YgoTournamentDeck {
  deckNum: number;
  deck_name: string;
  main_deck: string;
  extra_deck: string;
  side_deck: string;
  pretty_url?: string;
  tournamentName?: string | null;
  tournamentPlacement?: string | null;
  tournamentPlayerCount?: number | null;
}
