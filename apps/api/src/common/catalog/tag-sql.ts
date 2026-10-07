import { Prisma } from '../../generated/prisma/client';

/** Table de pose d'une étiquette et colonne qui désigne la cible. */
type TagLink = { table: 'CardTag'; column: 'cardId' } | { table: 'SetTag'; column: 'setId' };

/**
 * Condition « la cible porte TOUTES ces étiquettes » : cumuler des étiquettes restreint,
 * comme pour les facettes. La jointure sur `Tag` garantit qu'on ne filtre jamais sur
 * l'étiquette d'un autre compte, même si l'identifiant est deviné.
 */
export function allTagsOn(
  target: Prisma.Sql,
  link: TagLink,
  userId: string,
  tagIds: string[],
): Prisma.Sql {
  const table = Prisma.raw(`"${link.table}"`);
  const column = Prisma.raw(`"${link.column}"`);
  return Prisma.sql`(
    SELECT COUNT(DISTINCT tl."tagId") FROM ${table} tl JOIN "Tag" tg ON tg.id = tl."tagId"
    WHERE tl.${column} = ${target} AND tg."userId" = ${userId}
      AND tl."tagId" IN (${Prisma.join(tagIds)})
  ) = ${tagIds.length}`;
}

export const CARD_TAGS: TagLink = { table: 'CardTag', column: 'cardId' };
export const SET_TAGS: TagLink = { table: 'SetTag', column: 'setId' };

/** Étiquettes de l'utilisateur posées sur la cible, en tableau (jamais null). */
export function tagIdsOf(target: Prisma.Sql, link: TagLink, userId: string): Prisma.Sql {
  const table = Prisma.raw(`"${link.table}"`);
  const column = Prisma.raw(`"${link.column}"`);
  return Prisma.sql`(
    SELECT COALESCE(array_agg(tl."tagId"), '{}')
    FROM ${table} tl JOIN "Tag" tg ON tg.id = tl."tagId"
    WHERE tl.${column} = ${target} AND tg."userId" = ${userId})`;
}
