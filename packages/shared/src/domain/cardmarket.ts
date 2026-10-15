import type { CardCondition, CardLanguage } from './enums';
import { CARD_CONDITIONS } from './enums';

/**
 * Liens vers Cardmarket, la place de marché européenne où l'on achète les cartes à l'unité.
 *
 * Tout est construit ici, sans I/O et sans réseau : Cardmarket n'offre aucune API publique
 * utilisable sans compte vendeur, et leur site est derrière une protection anti-robot. On ne
 * lit donc jamais leurs pages — on fabrique une URL que l'utilisateur ouvre lui-même, dans
 * son navigateur, où il est déjà connecté.
 *
 * Deux limites assumées, qui expliquent la forme de ce module :
 *
 *  1. **On passe par la recherche, pas par la fiche produit.** Une fiche a l'adresse
 *     `/Products/Singles/<Extension>/<Carte>`, mais ces deux morceaux sont les noms de
 *     Cardmarket, qui ne sont pas ceux de notre catalogue (YGOPRODeck). Deviner le libellé
 *     d'une extension donnerait un 404 ; une recherche sur le nom anglais de la carte tombe
 *     toujours juste.
 *  2. **Il n'existe pas de panier pré-rempli par URL.** L'ajout au panier et à une liste de
 *     souhaits passe par une session connectée, carte par carte. Pour un deck entier, on
 *     produit donc un texte à coller (`wantsListText`), ce que l'assistant d'achat de
 *     Cardmarket sait ensuite exploiter pour trouver les vendeurs les moins chers.
 */

const BASE = 'https://www.cardmarket.com';

/** Les cinq langues d'interface de Cardmarket. Les autres retombent sur l'anglais. */
const SITE_LOCALES = new Set(['en', 'fr', 'de', 'it', 'es']);

/**
 * Identifiants de langue de Cardmarket, tels que leur API les documente. Les langues qu'ils
 * ne numérotent pas publiquement (japonais, coréen, portugais) sont absentes exprès : sans
 * identifiant sûr, mieux vaut une fiche non filtrée qu'un filtre au hasard.
 */
const LANGUAGE_IDS: Partial<Record<CardLanguage, number>> = {
  EN: 1,
  FR: 2,
  DE: 3,
  ES: 4,
  IT: 5,
};

/**
 * Les langues sur lesquelles on sait filtrer. C'est la liste à proposer dans un réglage :
 * offrir le japonais donnerait un choix sans effet, ce qui est pire que ne pas l'offrir.
 */
export const MARKET_LANGUAGES = Object.keys(LANGUAGE_IDS) as CardLanguage[];

/**
 * État minimum accepté. Cardmarket ordonne les états exactement comme nous (`CARD_CONDITIONS`),
 * du meilleur au pire, et les numérote à partir de 1 — d'où la position dans la liste.
 */
function conditionId(condition: CardCondition): number {
  return CARD_CONDITIONS.indexOf(condition) + 1;
}

/**
 * Le nom sous lequel une carte se cherche sur une place de marché : l'anglais quand on l'a,
 * sinon celui qu'on a. Les DTO ne portent `nameEn` que lorsqu'il diffère du nom affiché, donc
 * l'absence veut dire « le nom affiché EST l'anglais », pas « on ne sait pas ».
 */
export function marketName(card: { name: string; nameEn?: string }): string {
  return card.nameEn ?? card.name;
}

/** Ce que l'utilisateur veut voir en arrivant sur une fiche. Tout est facultatif. */
export interface MarketPreferences {
  /** Langue des exemplaires cherchés. Par défaut, celle de rangement de la collection. */
  language?: CardLanguage | null;
  /** État minimum accepté. */
  minCondition?: CardCondition | null;
}

/**
 * Lien vers une carte sur Cardmarket, filtré selon les préférences.
 *
 * `nameEn` est le nom ANGLAIS : c'est celui que Cardmarket indexe, et un nom français n'y
 * renvoie rien. Les filtres s'appliquent au tableau des offres une fois sur la fiche ; sur la
 * page de résultats ils sont simplement ignorés, ce qui ne coûte rien.
 */
export function cardmarketSearchUrl(
  nameEn: string,
  preferences: MarketPreferences = {},
  locale = 'en',
): string {
  const site = SITE_LOCALES.has(locale) ? locale : 'en';
  // Requête écrite à la main : ce paquet est partagé par le serveur, le navigateur et les
  // tests, et n'embarque aucun type de plateforme — `URL` n'y existe pas.
  const query = [`searchString=${encodeURIComponent(nameEn)}`];

  const language = preferences.language ? LANGUAGE_IDS[preferences.language] : undefined;
  if (language) query.push(`language=${language}`);
  if (preferences.minCondition) {
    query.push(`minCondition=${conditionId(preferences.minCondition)}`);
  }
  return `${BASE}/${site}/YuGiOh/Products/Search?${query.join('&')}`;
}

/** Les listes de souhaits de l'utilisateur, où se colle le texte produit ci-dessous. */
export function cardmarketWantsUrl(locale = 'en'): string {
  const site = SITE_LOCALES.has(locale) ? locale : 'en';
  return `${BASE}/${site}/YuGiOh/Wants`;
}

/** Une ligne de la liste à coller : une carte, et combien il en manque. */
export interface WantedCard {
  /** Nom anglais : le seul que Cardmarket reconnaît. */
  nameEn: string;
  quantity: number;
}

/**
 * Le texte à coller dans une liste de souhaits : une ligne par carte, `quantité nom`.
 *
 * Volontairement sans extension ni rareté. Cardmarket nomme ses extensions autrement que
 * notre catalogue, et une ligne dont l'extension n'est pas reconnue est rejetée entière — on
 * perdrait la carte pour gagner une précision que l'acheteur ajuste de toute façon sur place.
 * Les cartes sont rangées par nom pour que deux exports du même deck donnent le même texte,
 * et les doublons sont cumulés : une carte demandée en main et en extra n'y figure qu'une fois.
 */
export function wantsListText(cards: WantedCard[]): string {
  const total = new Map<string, number>();
  for (const { nameEn, quantity } of cards) {
    if (quantity > 0) total.set(nameEn, (total.get(nameEn) ?? 0) + quantity);
  }
  return [...total]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([name, quantity]) => `${quantity} ${name}`)
    .join('\n');
}
