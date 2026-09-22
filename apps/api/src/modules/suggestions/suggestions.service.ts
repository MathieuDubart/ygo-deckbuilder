import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ArchetypeSuggestionDto,
  CardSuggestionDto,
  MetaDeckSuggestionDto,
  MetaSuggestionQuery,
} from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import { OwnershipService } from '../collection/ownership.service';
import { computeCoverage } from './coverage';

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  /** "Quels decks meta je peux monter (ou presque) avec ma collection ?" */
  async metaDecks(userId: string, q: MetaSuggestionQuery): Promise<MetaDeckSuggestionDto[]> {
    const [decks, owned] = await Promise.all([
      this.prisma.metaDeck.findMany({
        include: {
          cards: {
            where: { flex: false },
            include: { card: { select: cardSummarySelect } },
          },
        },
      }),
      this.ownership.quantities(userId),
    ]);

    return decks
      .map((deck) => {
        const cardsById = new Map(deck.cards.map((c) => [c.cardId, c.card]));
        const result = computeCoverage(
          deck.cards.map((c) => ({
            cardId: c.cardId,
            zone: c.zone,
            quantity: c.quantity,
            unitPrice: toNumber(c.card.priceCardmarket),
          })),
          owned,
        );
        // Visuel : la carte la plus jouée du main (hors staples les plus courants, souvent la 1re)
        const cover = deck.cards
          .filter((c) => c.zone === 'MAIN')
          .sort((a, b) => b.inclusion - a.inclusion || b.quantity - a.quantity)[0]?.card;
        return {
          metaDeckId: deck.id,
          name: deck.name,
          archetype: deck.archetype,
          tier: deck.tier,
          source: deck.source,
          listCount: deck.listCount,
          share: deck.share,
          variants: deck.variants,
          coverImageUrl: cover?.imageUrl ?? cover?.imageUrlSmall ?? null,
          coverage: result.coverage,
          ownedCopies: result.ownedCopies,
          requiredCopies: result.requiredCopies,
          estimatedCostToComplete: result.estimatedCostToComplete,
          missing: result.missing.map((m) => ({
            card: toCardSummary(cardsById.get(m.cardId)!),
            zone: m.zone,
            required: m.quantity,
            owned: m.owned,
            missing: m.missing,
            unitPrice: m.unitPrice,
          })),
        };
      })
      .filter((s) => s.coverage >= q.minCoverage)
      .sort(
        (a, b) => b.coverage - a.coverage || a.estimatedCostToComplete - b.estimatedCostToComplete,
      )
      .slice(0, q.limit);
  }

  /** Archétypes les mieux représentés dans la collection → pistes de decks "maison". */
  async archetypes(userId: string): Promise<ArchetypeSuggestionDto[]> {
    return this.prisma.$queryRaw<ArchetypeSuggestionDto[]>`
      SELECT c.archetype AS "archetype",
             COUNT(DISTINCT c.id)::int AS "distinctCards",
             SUM(ci.quantity)::int AS "totalCopies"
      FROM "CollectionItem" ci
      JOIN "Card" c ON c.id = ci."cardId"
      WHERE ci."userId" = ${userId} AND c.archetype IS NOT NULL
      GROUP BY c.archetype
      ORDER BY "distinctCards" DESC, "totalCopies" DESC
      LIMIT 20`;
  }

  /**
   * Suggestions de cartes POSSÉDÉES pour compléter un deck en cours :
   *  1. même archétype que les cartes du deck
   *  2. cartes dont le texte cite une carte du deck (ou inversement)
   * V1 volontairement simple ; le futur moteur de synergie viendra se brancher ici.
   */
  async forDeck(userId: string, deckId: string, limit = 30): Promise<CardSuggestionDto[]> {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      include: {
        cards: {
          include: { card: { select: { id: true, name: true, archetype: true, desc: true } } },
        },
      },
    });
    if (!deck) throw new NotFoundException('Deck introuvable');

    const inDeck = new Set(deck.cards.map((c) => c.cardId));
    const archetypes = [
      ...new Set(deck.cards.map((c) => c.card.archetype).filter(Boolean)),
    ] as string[];
    const deckNames = deck.cards.map((c) => c.card.name);
    const deckText = deck.cards.map((c) => c.card.desc).join('\n');

    const ownedRows = await this.prisma.collectionItem.findMany({
      where: { userId, cardId: { notIn: [...inDeck] } },
      select: {
        cardId: true,
        quantity: true,
        card: { select: { ...cardSummarySelect, desc: true } },
      },
    });

    const byCard = new Map<number, { qty: number; card: (typeof ownedRows)[number]['card'] }>();
    for (const r of ownedRows) {
      const prev = byCard.get(r.cardId);
      byCard.set(r.cardId, { qty: (prev?.qty ?? 0) + r.quantity, card: r.card });
    }

    const out: CardSuggestionDto[] = [];
    for (const { qty, card } of byCard.values()) {
      let reason: CardSuggestionDto['reason'] | null = null;
      if (card.archetype && archetypes.includes(card.archetype)) reason = 'SAME_ARCHETYPE';
      else if (
        deckText.includes(`"${card.name}"`) ||
        deckNames.some((n) => card.desc.includes(`"${n}"`)) ||
        archetypes.some((a) => card.desc.includes(`"${a}"`))
      ) {
        reason = 'MENTIONED_IN_TEXT';
      }
      if (reason) out.push({ card: toCardSummary(card, qty), reason, ownedQuantity: qty });
    }

    return out
      .sort((a, b) =>
        a.reason === b.reason
          ? b.ownedQuantity - a.ownedQuantity
          : a.reason === 'SAME_ARCHETYPE'
            ? -1
            : 1,
      )
      .slice(0, limit);
  }
}
