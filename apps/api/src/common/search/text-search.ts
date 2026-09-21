import { Prisma } from '../../generated/prisma/client';
import { normalize, tokens } from './normalize';

/**
 * Fragments SQL de recherche texte sur une colonne "searchText" normalisée
 * (cf. migration "search" : ygo_normalize + index trigrammes).
 *
 * - strict : chaque mot tapé doit être le DÉBUT d'un mot du nom, dans n'importe quel ordre
 *            ("yeux bleu drag" → "Dragon Blanc aux Yeux Bleus", mais "tin" ≠ "Destiny")
 * - fuzzy  : repli tolérant aux fautes ("dragon blan yeu bleu") via word_similarity
 */
export interface TextQuery {
  normalized: string;
  strict: Prisma.Sql;
  fuzzy: Prisma.Sql;
  /** Score de similarité (0..1) pour trier par pertinence. */
  similarity: Prisma.Sql;
}

export const FUZZY_THRESHOLD = 0.45;

export function textQuery(
  raw: string,
  column: Prisma.Sql,
  normalizedOverride?: string,
): TextQuery | null {
  const normalized = normalizedOverride ?? normalize(raw);
  const words = tokens(normalized);
  if (!words.length) return null;
  // Les tokens normalisés ne contiennent que [a-z0-9] : pas de % ni _ à échapper.
  const patterns = words.map((w) => `% ${w}%`);
  return {
    normalized,
    strict: Prisma.sql`(' ' || ${column}) LIKE ALL (${patterns}::text[])`,
    fuzzy: Prisma.sql`word_similarity(${normalized}, ${column}) >= ${FUZZY_THRESHOLD}`,
    similarity: Prisma.sql`word_similarity(${normalized}, ${column})`,
  };
}
