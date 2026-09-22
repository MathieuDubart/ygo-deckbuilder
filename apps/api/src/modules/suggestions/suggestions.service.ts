import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ArchetypeSuggestionDto,
  CardSuggestionDto,
  MetaDeckSuggestionDto,
  MetaSuggestionQuery,
  CardSetDto,
  OfficialDeckQuery,
  OfficialDeckSuggestionDto,
} from '@ygo/shared';
import { SET_DTO_COLUMNS } from '../../common/catalog/product-sql';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import { OwnershipService } from '../collection/ownership.service';
import { officialDeckKind } from '../products/product-kind';
import { computeCoverage } from './coverage';
import { t } from '../../common/i18n/locale-context';

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

  /**
   * Decks préconstruits officiels (structure decks, starters, decks de coffrets) et ce que
   * la collection en couvre : « quel deck de la boîte je peux remonter avec mes cartes ? ».
   */
  async officialDecks(userId: string, q: OfficialDeckQuery): Promise<OfficialDeckSuggestionDto[]> {
    const [decks, owned, ownedProducts] = await Promise.all([
      this.prisma.productDeck.findMany({
        include: {
          cards: {
            include: {
              card: { select: { isExtraDeck: true, archetype: true, priceCardmarket: true } },
            },
          },
        },
      }),
      this.ownership.quantities(userId),
      this.prisma.ownedProduct.findMany({ where: { userId }, select: { setId: true } }),
    ]);
    if (!decks.length) return [];
    const sets = await this.prisma.$queryRaw<
      (Omit<CardSetDto, 'tcgDate'> & { tcgDate: Date | null })[]
    >`
      SELECT ${SET_DTO_COLUMNS} FROM "CardSet" s
      WHERE s.id IN (${Prisma.join([...new Set(decks.map((d) => d.setId))])})`;
    const setById = new Map(
      sets.map((r) => [r.id, { ...r, tcgDate: r.tcgDate?.toISOString().slice(0, 10) ?? null }]),
    );
    const ownedSets = new Set(ownedProducts.map((p) => p.setId));
    const decksPerSet = new Map<string, number>();
    for (const d of decks) decksPerSet.set(d.setId, (decksPerSet.get(d.setId) ?? 0) + 1);

    return decks
      .flatMap((deck): OfficialDeckSuggestionDto[] => {
        const product = setById.get(deck.setId);
        if (!product) return [];
        const kind = officialDeckKind(product.kind, decksPerSet.get(deck.setId) ?? 1);
        if (q.kind && kind !== q.kind) return [];
        const result = computeCoverage(
          deck.cards.map((c) => ({
            cardId: c.cardId,
            zone: c.card.isExtraDeck ? ('EXTRA' as const) : ('MAIN' as const),
            quantity: c.quantity,
            unitPrice: toNumber(c.card.priceCardmarket),
          })),
          owned,
        );
        const copies = new Map<string, number>();
        for (const c of deck.cards) {
          if (c.card.archetype) {
            copies.set(c.card.archetype, (copies.get(c.card.archetype) ?? 0) + c.quantity);
          }
        }
        const [archetype, n] = [...copies].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
        return [
          {
            productDeckId: deck.id,
            deckName: deck.name,
            kind,
            product,
            archetype: n >= 5 ? archetype : null,
            coverage: result.coverage,
            ownedCopies: result.ownedCopies,
            requiredCopies: result.requiredCopies,
            estimatedCostToComplete: result.estimatedCostToComplete,
            productOwned: ownedSets.has(deck.setId),
          },
        ];
      })
      .filter((d) => d.coverage >= q.minCoverage)
      .sort(
        (a, b) =>
          b.coverage - a.coverage ||
          a.estimatedCostToComplete - b.estimatedCostToComplete ||
          (b.product.tcgDate ?? '').localeCompare(a.product.tcgDate ?? ''),
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
    if (!deck) throw new NotFoundException(t('errors.deckNotFound'));

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
