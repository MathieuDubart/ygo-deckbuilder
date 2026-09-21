/**
 * Miroir TS de la fonction SQL ygo_normalize() (migration "search").
 * Sert uniquement côté requête (synonymes, découpage en mots) : le texte stocké
 * est toujours normalisé par Postgres, qui reste la référence.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đ]/g, 'd')
    .replace(/[ł]/g, 'l')
    .replace(/[ø]/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Les produits n'existent qu'avec leur nom anglais dans YGOPRODeck.
 * On traduit les termes FR courants pour qu'une recherche "deck de structure dragon"
 * trouve "Structure Deck: …".
 */
const PRODUCT_SYNONYMS: [RegExp, string][] = [
  [/\b(deck|decks) (de )?structure\b/g, 'structure deck'],
  [/\bstructure\b(?! deck)/g, 'structure deck'],
  [/\b(deck|decks) (de )?demarrage\b/g, 'starter deck'],
  [/\bmega (boite|boites|tin|tins)\b/g, 'mega tin'],
  [/\b(boite|boites) (en )?(metal|metallique)s?\b/g, 'tin'],
  [/\b(boite|boites)\b/g, 'tin'],
  [/\btins\b/g, 'tin'],
  [/\bduellistes? legendaires?\b/g, 'legendary duelists'],
  [/\bcollection legendaire\b/g, 'legendary collection'],
  [/\bedition speciale\b/g, 'special edition'],
  [/\bcoffret\b/g, 'box'],
  [/\bpaquets?\b/g, 'pack'],
];

export function normalizeProductQuery(q: string): string {
  let n = normalize(q);
  for (const [re, en] of PRODUCT_SYNONYMS) n = n.replace(re, en);
  return n.replace(/\s+/g, ' ').trim();
}

/** Découpe en mots pour un "tous les mots doivent apparaître, dans n'importe quel ordre". */
export const tokens = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter((t) => t.length > 0)
    .slice(0, 8);

export { parsePrintCode } from '@ygo/shared';
