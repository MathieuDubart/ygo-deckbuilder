import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parseYdk, type ImportMetaDeckInput } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';

@Injectable()
export class MetaDecksService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const decks = await this.prisma.metaDeck.findMany({
      orderBy: [{ tier: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      include: { _count: { select: { cards: true } } },
    });
    return decks.map(({ _count, ...d }) => ({ ...d, distinctCards: _count.cards }));
  }

  async get(id: string) {
    const deck = await this.prisma.metaDeck.findUnique({
      where: { id },
      include: { cards: { include: { card: { select: cardSummarySelect } } } },
    });
    if (!deck) throw new NotFoundException();
    return {
      ...deck,
      cards: deck.cards.map((c) => ({
        zone: c.zone,
        quantity: c.quantity,
        card: toCardSummary(c.card),
      })),
    };
  }

  /** Crée ou remplace (même nom + format) une decklist de référence depuis un .ydk. */
  async importYdk(input: ImportMetaDeckInput) {
    const entries = parseYdk(input.ydk);
    const known = new Set(
      (
        await this.prisma.card.findMany({
          where: { id: { in: entries.map((e) => e.cardId) } },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
    const cards = entries.filter((e) => known.has(e.cardId));
    if (!cards.length) throw new BadRequestException('Aucune carte reconnue dans ce .ydk');

    const meta = {
      archetype: input.archetype,
      tier: input.tier,
      sourceUrl: input.sourceUrl,
      source: 'manual',
    };
    return this.prisma.$transaction(async (tx) => {
      const deck = await tx.metaDeck.upsert({
        where: { name_format: { name: input.name, format: input.format } },
        create: { name: input.name, format: input.format, ...meta },
        update: meta,
      });
      await tx.metaDeckCard.deleteMany({ where: { metaDeckId: deck.id } });
      await tx.metaDeckCard.createMany({
        data: cards.map((c) => ({ ...c, quantity: Math.min(c.quantity, 3), metaDeckId: deck.id })),
      });
      return { id: deck.id, cards: cards.length, ignored: entries.length - cards.length };
    });
  }

  async remove(id: string) {
    await this.prisma.metaDeck.delete({ where: { id } });
  }
}
