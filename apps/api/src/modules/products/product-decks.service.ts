import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { t } from '../../common/i18n/locale-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fillDeck, type GenCardInfo } from '../meta-decks/engine/generator';
import {
  mainTargetFor,
  officialCandidates,
  STRUCTURE_COPIES,
  type OfficialCard,
} from './product-deck-build';

/**
 * À incrémenter pour relancer le rattrapage, par exemple après une évolution de
 * l'assembleur : les decks déjà montés sont reconnus et laissés tels quels, seuls les
 * manquants sont posés.
 */
const BACKFILL_VERSION = 1;
const BACKFILL_STATE_ID = 'product-decks-backfill';

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
export class ProductDecksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductDecksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rattrapage : les produits ajoutés avant que cette fonctionnalité existe n'ont jamais
   * reçu leur deck, et personne n'a envie de retirer puis réimporter sa collection pour en
   * profiter. On monte donc ce qui manque une fois, en arrière-plan — l'app reste utilisable
   * pendant, et le montage est rejouable, donc un démarrage interrompu se reprend seul.
   */
  async onApplicationBootstrap(): Promise<void> {
    const state = await this.prisma.syncState.findUnique({ where: { id: BACKFILL_STATE_ID } });
    if (state?.databaseVersion === String(BACKFILL_VERSION)) return;
    void this.backfill()
      .then(async (count) => {
        if (count) this.logger.log(`Decks de produits montés en rattrapage : ${count}`);
        const data = { databaseVersion: String(BACKFILL_VERSION), lastSyncAt: new Date() };
        await this.prisma.syncState.upsert({
          where: { id: BACKFILL_STATE_ID },
          create: { id: BACKFILL_STATE_ID, ...data },
          update: data,
        });
      })
      .catch((e) => this.logger.error(`Rattrapage des decks de produits : ${e}`));
  }

  /**
   * Monte les decks manquants de tous les produits déjà possédés. Les noms sortent dans la
   * langue par défaut du serveur : il n'y a pas de requête derrière un démarrage, et le nom
   * est de toute façon celui du produit.
   */
  async backfill(): Promise<number> {
    // Seuls les produits dont une liste officielle est connue : inutile d'interroger le
    // catalogue une fois par booster possédé.
    const withLists = new Set(
      (await this.prisma.productDeck.findMany({ select: { setId: true }, distinct: ['setId'] })).map(
        (l) => l.setId,
      ),
    );
    if (!withLists.size) return 0;

    const owned = await this.prisma.ownedProduct.findMany({
      where: { setId: { in: [...withLists] } },
      select: { userId: true, setId: true },
      distinct: ['userId', 'setId'],
    });

    let count = 0;
    for (const { userId, setId } of owned) {
      try {
        count += (await this.createFromSet(userId, setId)).length;
      } catch (e) {
        // Un produit qui résiste ne doit pas emporter les autres
        this.logger.warn(`Rattrapage du produit ${setId} : ${e}`);
      }
    }
    return count;
  }

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
    if (!lists.length) return [];

    // Une liste déjà montée ne l'est pas deux fois : l'import, le rattrapage au démarrage et
    // un second import du même produit visent tous la même ligne.
    const already = new Set(
      (
        await this.prisma.deck.findMany({
          where: { userId, productDeckId: { in: lists.map((l) => l.id) } },
          select: { productDeckId: true },
        })
      ).flatMap((d) => (d.productDeckId ? [d.productDeckId] : [])),
    );

    const created: CreatedProductDeck[] = [];
    for (const list of lists) {
      if (already.has(list.id)) continue;
      if (await this.adopt(userId, list)) continue;
      const deck = await this.createOne(userId, list);
      if (deck) created.push(deck);
    }
    return created;
  }

  /**
   * Rattache un deck monté avant que la provenance existe, au lieu d'en poser un second à
   * côté. On le reconnaît à son nom, qui est le même dans les cinq langues ; renommé, il
   * n'est pas reconnu — et c'est très bien, un deck qu'on a rebaptisé est devenu le sien.
   */
  private async adopt(
    userId: string,
    list: { id: string; name: string | null; set: { name: string } },
  ): Promise<boolean> {
    const orphan = await this.prisma.deck.findFirst({
      where: { userId, productDeckId: null, name: this.name(list) },
      select: { id: true },
    });
    if (!orphan) return false;
    await this.prisma.deck.update({
      where: { id: orphan.id },
      data: { productDeckId: list.id },
    });
    return true;
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
        productDeckId: list.id,
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
