import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AddWishlistItemInput, UpdateWishlistItemInput } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import type { Prisma } from '../../generated/prisma/client';
import { t } from '../../common/i18n/locale-context';

const include = {
  card: { select: cardSummarySelect },
  print: { include: { set: { select: { name: true, code: true } } } },
  deck: { select: { id: true, name: true } },
} satisfies Prisma.WishlistItemInclude;

type Row = Prisma.WishlistItemGetPayload<{ include: typeof include }>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    const items = rows.map(toDto);
    const totalEstimated = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);
    return { items, totalEstimated: Math.round(totalEstimated * 100) / 100 };
  }

  async add(userId: string, input: AddWishlistItemInput) {
    await this.assertRefs(userId, input.cardId, input.printId, input.deckId);
    const row = await this.prisma.wishlistItem.create({
      data: { ...input, userId },
      include,
    });
    return toDto(row);
  }

  async update(userId: string, id: string, input: UpdateWishlistItemInput) {
    const item = await this.findOwned(userId, id);
    await this.assertRefs(userId, item.cardId, input.printId, input.deckId);
    const row = await this.prisma.wishlistItem.update({ where: { id }, data: input, include });
    return toDto(row);
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.wishlistItem.delete({ where: { id } });
  }

  /** "Je l'ai eue !" : retire de la wishlist et ajoute à la collection, atomiquement. */
  async markAcquired(userId: string, id: string) {
    const item = await this.findOwned(userId, id);
    await this.prisma.$transaction([
      this.prisma.collectionItem.create({
        data: {
          userId,
          cardId: item.cardId,
          printId: item.printId,
          quantity: item.quantity,
          language: item.language ?? 'FR',
        },
      }),
      this.prisma.wishlistItem.delete({ where: { id } }),
    ]);
  }

  private async findOwned(userId: string, id: string) {
    const item = await this.prisma.wishlistItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException();
    return item;
  }

  private async assertRefs(userId: string, cardId: number, printId?: string, deckId?: string) {
    if (printId) {
      const p = await this.prisma.cardPrint.findUnique({ where: { id: printId } });
      if (!p || p.cardId !== cardId) throw new BadRequestException(t('errors.invalidPrint'));
    }
    if (deckId) {
      const d = await this.prisma.deck.findFirst({ where: { id: deckId, userId } });
      if (!d) throw new BadRequestException(t('errors.invalidDeck'));
    }
  }
}

function toDto(r: Row) {
  const printPrice = toNumber(r.print?.price);
  return {
    id: r.id,
    quantity: r.quantity,
    priority: r.priority,
    language: r.language,
    maxPrice: toNumber(r.maxPrice),
    notes: r.notes,
    card: toCardSummary(r.card),
    print: r.print && {
      id: r.print.id,
      printCode: r.print.printCode,
      rarity: r.print.rarity,
      setName: r.print.set.name,
      price: printPrice,
    },
    deck: r.deck,
    /** Prix de l'édition visée, sinon prix Cardmarket le plus bas de la carte. */
    unitPrice: printPrice ?? toNumber(r.card.priceCardmarket),
  };
}
