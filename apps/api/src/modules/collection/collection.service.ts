import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddCollectionItemInput,
  CollectionQueryInput,
  ImportSetInput,
  UpdateCollectionItemInput,
} from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
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

  async list(userId: string, q: CollectionQueryInput) {
    const where: Prisma.CollectionItemWhereInput = { userId };
    const text = q.q ? textQuery(q.q, Prisma.sql`c."searchText"`) : null;
    if (text) {
      // Même moteur que le catalogue (accents, ordre des mots…), restreint à la collection
      const rows = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT DISTINCT c.id FROM "Card" c
        JOIN "CollectionItem" ci ON ci."cardId" = c.id AND ci."userId" = ${userId}
        WHERE ${text.strict}`;
      where.cardId = { in: rows.map((r) => r.id) };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.collectionItem.count({ where }),
      this.prisma.collectionItem.findMany({
        where,
        include: itemInclude,
        orderBy: [
          { card: { nameFr: { sort: 'asc', nulls: 'last' } } },
          { card: { name: 'asc' } },
          { createdAt: 'asc' },
        ],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      items: rows.map(toItemDto),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
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
    return toItemDto(row);
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
    return toItemDto(row);
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

function toItemDto(row: ItemRow) {
  return {
    id: row.id,
    quantity: row.quantity,
    condition: row.condition,
    language: row.language,
    firstEdition: row.firstEdition,
    notes: row.notes,
    card: toCardSummary(row.card),
    print: row.print && {
      id: row.print.id,
      printCode: row.print.printCode,
      rarity: row.print.rarity,
      setName: row.print.set.name,
      price: toNumber(row.print.price),
    },
  };
}
