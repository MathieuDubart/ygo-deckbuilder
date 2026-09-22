import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parseYdk, type ImportMetaDeckInput } from '@ygo/shared';
import { CardResolver } from '../../common/catalog/card-resolver.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';
import { t } from '../../common/i18n/locale-context';

@Injectable()
export class MetaDecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CardResolver,
  ) {}

  async list() {
    const decks = await this.prisma.metaDeck.findMany({
      orderBy: [{ tier: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      include: { _count: { select: { cards: { where: { flex: false } } } } },
    });
    return decks.map(({ _count, ...d }) => ({ ...d, distinctCards: _count.cards }));
  }

  async get(id: string) {
    const deck = await this.prisma.metaDeck.findUnique({
      where: { id },
      include: {
        cards: {
          where: { flex: false }, // les cartes "flex" ne font pas partie de la liste type
          include: { card: { select: cardSummarySelect } },
        },
      },
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
    const ids = await this.resolver.resolve(entries.map((e) => e.cardId));
    const merged = new Map<
      string,
      { cardId: number; zone: (typeof entries)[number]['zone']; quantity: number }
    >();
    for (const e of entries) {
      const cardId = ids.get(e.cardId);
      if (cardId === undefined) continue;
      const key = `${e.zone}:${cardId}`;
      const prev = merged.get(key);
      merged.set(key, { cardId, zone: e.zone, quantity: (prev?.quantity ?? 0) + e.quantity });
    }
    const cards = [...merged.values()];
    if (!cards.length) throw new BadRequestException(t('errors.ydkNoCards'));

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
      return { id: deck.id, cards: cards.length };
    });
  }

  async remove(id: string) {
    await this.prisma.metaDeck.delete({ where: { id } });
  }
}
