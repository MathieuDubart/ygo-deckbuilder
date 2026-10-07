import { currentLocale } from '../i18n/locale-context';
import { Prisma } from '../../generated/prisma/client';

/**
 * Nom affiché dans la langue de la requête ; on trie sur sa forme normalisée (É = E).
 * Alias de table attendu : `c` pour `Card`.
 */
export function displayName(): Prisma.Sql {
  const locale = currentLocale();
  if (locale === 'en') return Prisma.sql`ygo_normalize(c."name")`;
  if (locale === 'fr') return Prisma.sql`ygo_normalize(coalesce(c."nameFr", c."name"))`;
  return Prisma.sql`ygo_normalize(coalesce(
    (SELECT tr.name FROM "CardTranslation" tr WHERE tr."cardId" = c.id AND tr.locale = ${locale}),
    c."name"))`;
}
