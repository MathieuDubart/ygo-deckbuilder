import { Prisma } from '../../generated/prisma/client';

/**
 * Requêtes partagées par les services sociaux. Elles sont écrites en SQL parce qu'elles
 * agrègent plusieurs tables pour plusieurs comptes d'un coup : une boucle de requêtes Prisma
 * par ami coûterait un aller-retour par ligne de liste.
 */

export interface SocialStatsRow {
  userId: string;
  distinctCards: number;
  copies: number;
  sets: number;
  completedSets: number;
}

/**
 * Repères de collection pour un lot de comptes. Rien d'identifiant ni de nominatif : des
 * compteurs, ce que les amis ont le droit de voir.
 */
export const socialStats = (userIds: string[]) => Prisma.sql`
  SELECT u.id                                   AS "userId",
         COALESCE(c."distinctCards", 0)::int    AS "distinctCards",
         COALESCE(c.copies, 0)::int             AS copies,
         COALESCE(s.sets, 0)::int               AS sets,
         COALESCE(s."completedSets", 0)::int    AS "completedSets"
  FROM "User" u
  LEFT JOIN (
    SELECT "userId",
           COUNT(DISTINCT "cardId") AS "distinctCards",
           SUM(quantity)            AS copies
    FROM "CollectionItem"
    WHERE "userId" IN (${Prisma.join(userIds)})
    GROUP BY "userId"
  ) c ON c."userId" = u.id
  LEFT JOIN (
    SELECT "userId",
           COUNT(*) AS sets,
           -- Complète à l'impression près, et seulement si la liste est connue
           COUNT(*) FILTER (WHERE prints > 0 AND "ownedPrints" >= prints) AS "completedSets"
    FROM "SetProgress"
    WHERE "userId" IN (${Prisma.join(userIds)})
    GROUP BY "userId"
  ) s ON s."userId" = u.id
  WHERE u.id IN (${Prisma.join(userIds)})
`;

export interface FriendSetProgressRow {
  userId: string;
  setId: string;
  prints: number;
  cards: number;
  ownedPrints: number;
  ownedCards: number;
}

/**
 * Avancement d'un lot d'amis sur un lot d'extensions. Lu dans `SetProgress`, donc au même prix
 * que son propre avancement — et une extension dont un ami n'a aucune carte n'a pas de ligne,
 * ce qui est voulu : on ne liste que ceux qui ont commencé.
 */
export const friendsSetProgress = (userIds: string[], setIds: string[]) => Prisma.sql`
  SELECT "userId", "setId", prints::int, cards::int,
         "ownedPrints"::int, "ownedCards"::int
  FROM "SetProgress"
  WHERE "userId" IN (${Prisma.join(userIds)})
    AND "setId" IN (${Prisma.join(setIds)})
    AND "ownedPrints" > 0
`;

export interface PrintOwnerRow {
  userId: string;
  printId: string;
}

/** Qui possède exactement cette impression, parmi les amis. */
export const printOwners = (userIds: string[], setId: string) => Prisma.sql`
  SELECT DISTINCT ci."userId", p.id AS "printId"
  FROM "CardPrint" p
  JOIN "CollectionItem" ci ON ci."printId" = p.id
  WHERE p."setId" = ${setId}
    AND ci."userId" IN (${Prisma.join(userIds)})
`;

/**
 * Qui possède la carte dans une AUTRE édition. Le `NOT EXISTS` évite de répéter ceux qui ont
 * déjà l'impression exacte : les deux listes sont disjointes, comme les deux pastilles côté
 * interface.
 */
export const anyEditionOwners = (userIds: string[], setId: string) => Prisma.sql`
  SELECT DISTINCT ci."userId", p.id AS "printId"
  FROM "CardPrint" p
  JOIN "CollectionItem" ci ON ci."cardId" = p."cardId"
  WHERE p."setId" = ${setId}
    AND ci."userId" IN (${Prisma.join(userIds)})
    AND NOT EXISTS (
      SELECT 1 FROM "CollectionItem" x
      WHERE x."userId" = ci."userId" AND x."printId" = p.id
    )
`;

export interface ProfileCardRow {
  printId: string;
  printCode: string;
  rarity: string;
  setName: string;
  cardId: number;
  position: number;
}

/**
 * Cartes mises en avant, filtrées par la possession au moment de la lecture : une carte vendue
 * ou retirée de la collection disparaît du profil sans qu'on ait à nettoyer la table.
 */
export const profileCards = (userId: string) => Prisma.sql`
  SELECT pc."printId", p."printCode", p.rarity, s.name AS "setName",
         p."cardId", pc.position::int
  FROM "ProfileCard" pc
  JOIN "CardPrint" p ON p.id = pc."printId"
  JOIN "CardSet" s ON s.id = p."setId"
  WHERE pc."userId" = ${userId}
    AND EXISTS (
      SELECT 1 FROM "CollectionItem" ci
      WHERE ci."userId" = pc."userId" AND ci."printId" = pc."printId"
    )
  ORDER BY pc.position ASC
`;
