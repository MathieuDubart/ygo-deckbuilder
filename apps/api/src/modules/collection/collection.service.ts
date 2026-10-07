import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddCollectionItemInput,
  CollectionFacetsDto,
  CollectionQueryInput,
  Paginated,
  UpdateCollectionItemInput,
} from '@ygo/shared';
import { allTagsOn, CARD_TAGS } from '../../common/catalog/tag-sql';
import { PrismaService } from '../../common/prisma/prisma.service';
import { displayName } from '../../common/search/display-name';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import { textQuery } from '../../common/search/text-search';
import { Prisma } from '../../generated/prisma/client';
import { t } from '../../common/i18n/locale-context';

const itemInclude = {
  card: { select: cardSummarySelect },
  print: { include: { set: { select: { name: true, code: true } } } },
} satisfies Prisma.CollectionItemInclude;

type ItemRow = Prisma.CollectionItemGetPayload<{ include: typeof itemInclude }>;

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Les piles de la collection, filtrées par facettes cumulables et par étiquettes. La
   * sélection se fait en SQL (c'est le seul moyen de trier sur une valeur calculée comme
   * quantité × prix), puis les lignes retenues sont rechargées avec leurs relations.
   */
  async list(userId: string, q: CollectionQueryInput): Promise<Paginated<CollectionItemDto>> {
    const picked = await this.prisma.$queryRaw<{ id: string; total: number }[]>`
      SELECT ci.id, (COUNT(*) OVER ())::int AS total
      FROM "CollectionItem" ci
      JOIN "Card" c ON c.id = ci."cardId"
      LEFT JOIN "CardPrint" p ON p.id = ci."printId"
      WHERE ${Prisma.join(this.conditions(userId, q), ' AND ')}
      ORDER BY ${this.orderBy(q.sort ?? 'name')}
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;

    const total = picked[0]?.total ?? 0;
    const rows = picked.length
      ? await this.prisma.collectionItem.findMany({
          where: { id: { in: picked.map((r) => r.id) } },
          include: itemInclude,
        })
      : [];
    // La requête SQL porte l'ordre ; `findMany` ne le garantit pas.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = picked.flatMap((r) => {
      const row = byId.get(r.id);
      return row ? [row] : [];
    });
    const tags = await this.tagsByCard(
      userId,
      ordered.map((row) => row.cardId),
    );

    return {
      items: ordered.map((row) => toItemDto(row, tags.get(row.cardId) ?? [])),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }

  /**
   * Valeurs de filtre réellement présentes dans la collection, avec leur effectif. Elles
   * sont calculées sur toute la collection et non sur le résultat filtré : les pastilles
   * restent stables pendant qu'on affine, au lieu de disparaître sous le doigt.
   */
  async facets(userId: string): Promise<CollectionFacetsDto> {
    const rows = await this.prisma.$queryRaw<{ facet: string; value: string; count: number }[]>`
      WITH mine AS (
        SELECT ci.*, c.category, c.archetype, c.attribute, c.race, p.rarity
        FROM "CollectionItem" ci
        JOIN "Card" c ON c.id = ci."cardId"
        LEFT JOIN "CardPrint" p ON p.id = ci."printId"
        WHERE ci."userId" = ${userId}
      )
      SELECT 'categories' AS facet, category::text AS value, COUNT(*)::int AS count
        FROM mine GROUP BY 2
      UNION ALL
      SELECT 'archetypes', archetype, COUNT(*)::int FROM mine WHERE archetype IS NOT NULL GROUP BY 2
      UNION ALL
      SELECT 'attributes', attribute, COUNT(*)::int FROM mine WHERE attribute IS NOT NULL GROUP BY 2
      UNION ALL
      SELECT 'races', race, COUNT(*)::int FROM mine WHERE race IS NOT NULL GROUP BY 2
      UNION ALL
      SELECT 'rarities', rarity, COUNT(*)::int FROM mine WHERE rarity IS NOT NULL GROUP BY 2
      UNION ALL
      SELECT 'languages', language::text, COUNT(*)::int FROM mine GROUP BY 2
      UNION ALL
      SELECT 'conditions', condition::text, COUNT(*)::int FROM mine GROUP BY 2
      UNION ALL
      SELECT 'sets', p."setId", COUNT(*)::int
        FROM mine m JOIN "CardPrint" p ON p.id = m."printId" GROUP BY 2`;

    const group = (facet: string) =>
      rows
        .filter((r) => r.facet === facet)
        .map(({ value, count }) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return {
      categories: group('categories'),
      archetypes: group('archetypes'),
      attributes: group('attributes'),
      races: group('races'),
      rarities: group('rarities'),
      languages: group('languages'),
      conditions: group('conditions'),
      sets: group('sets'),
    };
  }

  private conditions(userId: string, q: CollectionQueryInput): Prisma.Sql[] {
    const conditions = [Prisma.sql`ci."userId" = ${userId}`];
    // Même moteur de recherche que le catalogue (accents, ordre des mots…)
    const text = q.q ? textQuery(q.q, Prisma.sql`c."searchText"`) : null;
    if (text) conditions.push(text.strict);
    if (q.category) conditions.push(Prisma.sql`c.category = ${q.category}::"CardCategory"`);
    if (q.archetype) conditions.push(Prisma.sql`lower(c.archetype) = lower(${q.archetype})`);
    if (q.attribute) conditions.push(Prisma.sql`lower(c.attribute) = lower(${q.attribute})`);
    if (q.race) conditions.push(Prisma.sql`lower(c.race) = lower(${q.race})`);
    if (q.rarity) conditions.push(Prisma.sql`p.rarity = ${q.rarity}`);
    if (q.setId) conditions.push(Prisma.sql`p."setId" = ${q.setId}`);
    if (q.language) conditions.push(Prisma.sql`ci.language = ${q.language}::"CardLanguage"`);
    if (q.condition) conditions.push(Prisma.sql`ci.condition = ${q.condition}::"CardCondition"`);
    if (q.firstEdition) conditions.push(Prisma.sql`ci."firstEdition" = true`);
    if (q.tagIds?.length) {
      conditions.push(allTagsOn(Prisma.sql`c.id`, CARD_TAGS, userId, q.tagIds));
    }
    return conditions;
  }

  private orderBy(sort: NonNullable<CollectionQueryInput['sort']>): Prisma.Sql {
    switch (sort) {
      case 'quantity':
        return Prisma.sql`ci.quantity DESC, ${displayName()}`;
      case 'value':
        return Prisma.sql`(ci.quantity * COALESCE(p.price, c."priceCardmarket")) DESC NULLS LAST,
          ${displayName()}`;
      case 'newest':
        return Prisma.sql`ci."createdAt" DESC, ${displayName()}`;
      case 'rarity':
        return Prisma.sql`p.rarity ASC NULLS LAST, ${displayName()}`;
      default:
        return Prisma.sql`${displayName()}, ci."createdAt"`;
    }
  }

  private async cardTags(userId: string, cardId: number): Promise<string[]> {
    return (await this.tagsByCard(userId, [cardId])).get(cardId) ?? [];
  }

  /** Étiquettes posées sur chacune des cartes de la page. */
  private async tagsByCard(userId: string, cardIds: number[]): Promise<Map<number, string[]>> {
    if (!cardIds.length) return new Map();
    const rows = await this.prisma.cardTag.findMany({
      where: { cardId: { in: [...new Set(cardIds)] }, tag: { userId } },
      select: { cardId: true, tagId: true },
    });
    const byCard = new Map<number, string[]>();
    for (const row of rows) {
      byCard.set(row.cardId, [...(byCard.get(row.cardId) ?? []), row.tagId]);
    }
    return byCard;
  }

  async stats(userId: string) {
    const [agg, distinct, value] = await Promise.all([
      this.prisma.collectionItem.aggregate({ where: { userId }, _sum: { quantity: true } }),
      this.prisma.collectionItem.groupBy({ by: ['cardId'], where: { userId } }),
      this.prisma.$queryRaw<{ total: number | null }[]>`
        SELECT SUM(ci.quantity * COALESCE(cp.price, c."priceCardmarket"))::float AS total
        FROM "CollectionItem" ci
        JOIN "Card" c ON c.id = ci."cardId"
        LEFT JOIN "CardPrint" cp ON cp.id = ci."printId"
        WHERE ci."userId" = ${userId}`,
    ]);
    return {
      totalCopies: agg._sum.quantity ?? 0,
      distinctCards: distinct.length,
      estimatedValue: value[0]?.total ?? 0,
    };
  }

  /** Ajoute des exemplaires ; fusionne avec une pile identique si elle existe. */
  async add(userId: string, input: AddCollectionItemInput) {
    await this.assertPrintMatchesCard(input.cardId, input.printId);
    const identity = {
      userId,
      cardId: input.cardId,
      printId: input.printId ?? null,
      condition: input.condition,
      language: input.language,
      firstEdition: input.firstEdition,
    };
    const existing = await this.prisma.collectionItem.findFirst({ where: identity });
    const row = existing
      ? await this.prisma.collectionItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: input.quantity }, notes: input.notes ?? existing.notes },
          include: itemInclude,
        })
      : await this.prisma.collectionItem.create({
          data: { ...identity, quantity: input.quantity, notes: input.notes },
          include: itemInclude,
        });
    return toItemDto(row, await this.cardTags(userId, row.cardId));
  }

  async update(userId: string, id: string, input: UpdateCollectionItemInput) {
    const item = await this.findOwned(userId, id);
    if (input.quantity === 0) {
      await this.prisma.collectionItem.delete({ where: { id } });
      return null;
    }
    await this.assertPrintMatchesCard(item.cardId, input.printId);
    const row = await this.prisma.collectionItem.update({
      where: { id },
      data: input,
      include: itemInclude,
    });
    return toItemDto(row, await this.cardTags(userId, row.cardId));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.collectionItem.delete({ where: { id } });
  }

  /**
   * Ajoute toutes les cartes d'un set (ex: un Structure Deck acheté).
   * NB : YGOPRODeck ne donne pas les quantités exactes par produit (3x certaines cartes
   * dans les structures) — on ajoute `copies` exemplaires de chaque, à ajuster ensuite.
   */
  private async findOwned(userId: string, id: string) {
    const item = await this.prisma.collectionItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException();
    return item;
  }

  private async assertPrintMatchesCard(cardId: number, printId?: string | null) {
    if (!printId) return;
    const print = await this.prisma.cardPrint.findUnique({ where: { id: printId } });
    if (!print || print.cardId !== cardId) {
      throw new BadRequestException(t('errors.printMismatch'));
    }
  }
}

type CollectionItemDto = ReturnType<typeof toItemDto>;

function toItemDto(row: ItemRow, tagIds: string[]) {
  return {
    id: row.id,
    quantity: row.quantity,
    condition: row.condition,
    language: row.language,
    firstEdition: row.firstEdition,
    notes: row.notes,
    card: { ...toCardSummary(row.card), tagIds },
    print: row.print && {
      id: row.print.id,
      printCode: row.print.printCode,
      rarity: row.print.rarity,
      setName: row.print.set.name,
      price: toNumber(row.print.price),
    },
  };
}
