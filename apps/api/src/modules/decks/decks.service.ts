import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  parseYdk,
  toYdk,
  validateDeck,
  type CreateDeckInput,
  type DeckCardInput,
  type DeckDto,
  type DeckListItemDto,
  type ImportYdkInput,
  type UpdateDeckInput,
} from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';
import type { Prisma } from '../../generated/prisma/client';
import { CardResolver } from '../../common/catalog/card-resolver.service';
import { OwnershipService } from '../collection/ownership.service';
import { t } from '../../common/i18n/locale-context';

const deckInclude = {
  cards: { include: { card: { select: cardSummarySelect } } },
} satisfies Prisma.DeckInclude;

type DeckRow = Prisma.DeckGetPayload<{ include: typeof deckInclude }>;

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly resolver: CardResolver,
  ) {}

  async list(userId: string): Promise<DeckListItemDto[]> {
    const decks = await this.prisma.deck.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        cards: { include: { card: { select: { imageUrl: true, imageUrlSmall: true } } } },
      },
    });
    return decks.map((d) => {
      const cover = d.cards.find((c) => c.zone === 'MAIN')?.card;
      const count = (zone: string) =>
        d.cards.filter((c) => c.zone === zone).reduce((s, c) => s + c.quantity, 0);
      return {
        id: d.id,
        name: d.name,
        format: d.format,
        updatedAt: d.updatedAt.toISOString(),
        mainCount: count('MAIN'),
        extraCount: count('EXTRA'),
        sideCount: count('SIDE'),
        coverImageUrl: cover ? (cover.imageUrl ?? cover.imageUrlSmall) : null,
      };
    });
  }

  async get(userId: string, id: string): Promise<DeckDto> {
    const deck = await this.prisma.deck.findFirst({
      where: { id, OR: [{ userId }, { isPublic: true }] },
      include: deckInclude,
    });
    if (!deck) throw new NotFoundException(t('errors.deckNotFound'));
    return this.toDto(deck, userId);
  }

  async create(userId: string, input: CreateDeckInput): Promise<DeckDto> {
    await this.assertCardsExist(input.cards);
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        format: input.format,
        isPublic: input.isPublic,
        cards: { create: mergeEntries(input.cards) },
      },
      include: deckInclude,
    });
    return this.toDto(deck, userId);
  }

  /** Si `cards` est fourni, il remplace intégralement la decklist (le builder envoie l'état complet). */
  async update(userId: string, id: string, input: UpdateDeckInput): Promise<DeckDto> {
    await this.assertOwned(userId, id);
    const { cards, ...meta } = input;
    if (cards) await this.assertCardsExist(cards);

    const deck = await this.prisma.$transaction(async (tx) => {
      if (cards) {
        await tx.deckCard.deleteMany({ where: { deckId: id } });
        await tx.deckCard.createMany({
          data: mergeEntries(cards).map((c) => ({ ...c, deckId: id })),
        });
      }
      return tx.deck.update({ where: { id }, data: meta, include: deckInclude });
    });
    return this.toDto(deck, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.prisma.deck.delete({ where: { id } });
  }

  async duplicate(userId: string, id: string): Promise<DeckDto> {
    const src = await this.get(userId, id);
    return this.create(userId, {
      name: `${src.name} (copie)`,
      description: src.description ?? undefined,
      format: src.format,
      isPublic: false,
      cards: src.cards.map(({ cardId, zone, quantity }) => ({ cardId, zone, quantity })),
    });
  }

  async importYdk(userId: string, input: ImportYdkInput): Promise<DeckDto> {
    const parsed = parseYdk(input.content);
    if (!parsed.length) throw new BadRequestException(t('errors.ydkEmpty'));
    // Artworks alternatifs → carte principale ; cartes inconnues ignorées plutôt que de tout rejeter
    const ids = await this.resolver.resolve(parsed.map((e) => e.cardId));
    const cards = parsed.flatMap((e) => {
      const cardId = ids.get(e.cardId);
      return cardId === undefined ? [] : [{ ...e, cardId }];
    });
    return this.create(userId, {
      name: input.name,
      format: input.format,
      isPublic: false,
      cards: mergeEntries(cards).map((e) => ({ ...e, quantity: Math.min(e.quantity, 3) })),
    });
  }

  async exportYdk(userId: string, id: string): Promise<string> {
    const deck = await this.get(userId, id);
    return toYdk(deck.cards);
  }

  private async toDto(deck: DeckRow, userId: string): Promise<DeckDto> {
    const owned = await this.ownership.quantities(
      userId,
      deck.cards.map((c) => c.cardId),
    );
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      format: deck.format,
      isPublic: deck.isPublic,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
      cards: deck.cards.map((c) => ({
        cardId: c.cardId,
        zone: c.zone,
        quantity: c.quantity,
        ownedQuantity: owned.get(c.cardId) ?? 0,
        card: toCardSummary(c.card),
      })),
      issues: validateDeck(
        deck.cards.map((c) => ({
          cardId: c.cardId,
          zone: c.zone,
          quantity: c.quantity,
          isExtraDeckMonster: c.card.isExtraDeck,
          banStatus: deck.format === 'OCG' ? undefined : c.card.banTcg,
        })),
      ),
    };
  }

  private async assertOwned(userId: string, id: string) {
    const deck = await this.prisma.deck.findFirst({ where: { id, userId }, select: { id: true } });
    if (!deck) throw new NotFoundException(t('errors.deckNotFound'));
  }

  private async assertCardsExist(cards: DeckCardInput[]) {
    const ids = [...new Set(cards.map((c) => c.cardId))];
    if (!ids.length) return;
    const count = await this.prisma.card.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException(t('errors.unknownCards'));
  }
}

/** Fusionne les doublons (même carte + même zone) envoyés par le client. */
function mergeEntries(cards: DeckCardInput[]): DeckCardInput[] {
  const map = new Map<string, DeckCardInput>();
  for (const c of cards) {
    const key = `${c.zone}:${c.cardId}`;
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, quantity: prev.quantity + c.quantity } : { ...c });
  }
  return [...map.values()];
}
