import { Injectable, Logger } from '@nestjs/common';
import { t } from '../../common/i18n/locale-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fillDeck, type GenCardInfo } from '../meta-decks/engine/generator';
import {
  mainTargetFor,
  officialCandidates,
  STRUCTURE_COPIES,
  type OfficialCard,
} from './product-deck-build';

/** Un deck posé dans « Mes decks » à partir d'une liste officielle. */
export interface CreatedProductDeck {
  id: string;
  name: string;
}

/**
 * Les decks d'un produit, montés et rangés dans « Mes decks ».
 *
 * Un structure deck est vendu en un exemplaire de presque tout, mais personne ne le joue
 * comme ça : on en achète trois et on garde les bonnes cartes en triple. C'est donc cette
 * liste-là qu'on crée, même avec une seule boîte — le builder affiche alors ce qui manque, et
 * le bouton wishlist chiffre ce qu'il reste à acheter. Un deck qui montre où l'on va vaut
 * mieux qu'un deck qui décrit ce qu'on a déjà.
 */
@Injectable()
export class ProductDecksService {
  private readonly logger = new Logger(ProductDecksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un deck par liste officielle du produit. Un coffret à deux decks donne deux decks :
   * c'est ainsi qu'ils sont vendus et joués.
   */
  async createFromSet(userId: string, setId: string): Promise<CreatedProductDeck[]> {
    const lists = await this.prisma.productDeck.findMany({
      where: { setId },
      orderBy: { position: 'asc' },
      include: {
        set: { select: { name: true } },
        cards: { include: { card: { select: { isExtraDeck: true, banTcg: true, category: true } } } },
      },
    });

    const created: CreatedProductDeck[] = [];
    for (const list of lists) {
      const deck = await this.createOne(userId, list);
      if (deck) created.push(deck);
    }
    return created;
  }

  private async createOne(
    userId: string,
    list: Awaited<ReturnType<ProductDecksService['listsOf']>>[number],
  ): Promise<CreatedProductDeck | null> {
    if (list.cards.length === 0) return null;

    const shares = await this.deckShares(list.cards.map((c) => c.cardId));
    const official: OfficialCard[] = list.cards.map((c) => ({
      cardId: c.cardId,
      quantity: c.quantity,
      deckShare: shares.get(c.cardId) ?? null,
    }));

    const cards = new Map<number, GenCardInfo>(
      list.cards.map((c) => [
        c.cardId,
        {
          id: c.cardId,
          isExtraDeck: c.card.isExtraDeck,
          banTcg: c.card.banTcg,
          category: c.card.category,
        },
      ]),
    );

    // `onlyOwned: false` : la liste décrit le produit, pas la collection. L'assembleur applique
    // quand même la banlist — une carte interdite depuis la sortie du produit n'y entre pas.
    const result = fillDeck(officialCandidates(official, STRUCTURE_COPIES), {
      cards,
      owned: new Map(),
      onlyOwned: false,
      mainTarget: mainTargetFor(official, STRUCTURE_COPIES),
    });
    if (result.entries.length === 0) return null;

    const name = this.name(list);
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name,
        description: t('products.deckFromProduct', { name: list.set.name }),
        cards: {
          create: result.entries.map((e) => ({
            cardId: e.cardId,
            zone: e.zone,
            quantity: e.quantity,
          })),
        },
      },
      select: { id: true },
    });
    this.logger.log(`Deck « ${name} » créé depuis ${list.set.name}`);
    return { id: deck.id, name };
  }

  /** Nom du deck : le produit, et la liste quand le produit en contient plusieurs. */
  private name(list: { name: string | null; set: { name: string } }): string {
    const base = list.name ? `${list.set.name} — ${list.name}` : list.set.name;
    return t('products.deckName', { name: base, copies: STRUCTURE_COPIES });
  }

  /** Taux de jeu en tournoi, pour départager deux cartes à égalité d'exemplaires. */
  private async deckShares(cardIds: number[]): Promise<Map<number, number>> {
    const stats = await this.prisma.cardMetaStat.findMany({
      where: { cardId: { in: cardIds } },
      select: { cardId: true, deckShare: true },
    });
    return new Map(stats.map((s) => [s.cardId, s.deckShare]));
  }

  /** Signature de la requête ci-dessus, pour typer `createOne` sans la dupliquer. */
  private listsOf(setId: string) {
    return this.prisma.productDeck.findMany({
      where: { setId },
      include: {
        set: { select: { name: true } },
        cards: { include: { card: { select: { isExtraDeck: true, banTcg: true, category: true } } } },
      },
    });
  }
}
