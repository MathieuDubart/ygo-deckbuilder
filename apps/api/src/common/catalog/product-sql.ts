import { Prisma } from '../../generated/prisma/client';

/**
 * Type de produit déduit du nom normalisé (YGOPRODeck ne le fournit pas). Alias attendu : s.
 *
 * Les boosters sont le cas tordu : un booster principal ne porte presque jamais le mot
 * « pack » (« Metal Raiders », « Phantom Nightmare »…). On attrape donc d'abord les familles
 * nommées, puis on se rabat sur la taille annoncée du produit — en dessous de cinquante
 * cartes, aucun booster principal, et au-dessus, aucun deck.
 */
export const PRODUCT_KIND = Prisma.sql`CASE
  WHEN s."searchText" ~ '(^| )(structure deck|structure decks)( |$)' THEN 'STRUCTURE'
  WHEN s."searchText" ~ '(^| )(mega )?tins?( |$)' THEN 'TIN'
  WHEN s."searchText" ~ '(^| )(starter decks?|starter set|starter kit|super starter)( |$)' THEN 'STARTER'
  WHEN s."searchText" ~ '(^| )(box|collection|legendary( [a-z0-9]+){0,2} decks|chronicles deck|anniversary pack)( |$)' THEN 'BOX'
  WHEN s."searchText" ~ '(^| )(booster (pack|box)|duelist packs?|battle pack|star pack|premium pack|advance pack|extra pack|hidden arsenal|deck build pack|dark beginning|dark revelation)( |$)'
    OR COALESCE(s."cardCount", 0) >= 50 THEN 'BOOSTER'
  ELSE 'OTHER' END`;

/** Illustration de la première carte du produit (dernier recours pour le visuel). */
export const FIRST_CARD_IMAGE = Prisma.sql`(
  SELECT c."imageUrl" FROM "CardPrint" p JOIN "Card" c ON c.id = p."cardId"
  WHERE p."setId" = s.id AND c."imageUrl" IS NOT NULL
  ORDER BY p."printCode" LIMIT 1)`;

/** Colonnes d'un CardSetDto (alias s). */
export const SET_DTO_COLUMNS = Prisma.sql`
  s.id, s.name, s.code, s."tcgDate",
  ${PRODUCT_KIND} AS kind,
  COALESCE(s."coverUrl", s."imageUrl", ${FIRST_CARD_IMAGE}) AS "imageUrl",
  CASE WHEN s."coverUrl" IS NOT NULL
    THEN COALESCE(s."imageUrl", ${FIRST_CARD_IMAGE}) END AS "fallbackImageUrl",
  (SELECT COUNT(DISTINCT p."cardId")::int FROM "CardPrint" p WHERE p."setId" = s.id) AS "cardCount"`;
