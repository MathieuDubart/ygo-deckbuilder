import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CardLanguage,
  CardSetDto,
  ImportSetInput,
  ImportSetResultDto,
  OwnedProductCardDto,
  OwnedProductDetailDto,
  OwnedProductDto,
  OwnedProductsQueryInput,
} from '@ygo/shared';
import { SET_DTO_COLUMNS } from '../../common/catalog/product-sql';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { collectionLanguageOf } from '../../common/catalog/collection-language';
import { normalize } from '../../common/search/normalize';
import { Prisma } from '../../generated/prisma/client';
import { OwnershipService } from '../collection/ownership.service';
import { SetProgressService } from '../collection/set-progress.service';
import { ProductContentService } from './product-content.service';
import { isDeckProduct } from './product-kind';
import { productCards, type ProductCard } from './quantities';
import { t } from '../../common/i18n/locale-context';

type SetRow = Omit<CardSetDto, 'tcgDate'> & { tcgDate: Date | null };
/** Produit + « ses quantités officielles sont connues » */
type VerifiedSet = CardSetDto & { verified: boolean };

interface ProductRow {
  id: string;
  setId: string;
  copies: number;
  language: CardLanguage;
  createdAt: Date;
}

/** Identité des exemplaires ajoutés par un import de produit (neufs, non 1ère édition). */
const importIdentity = (userId: string, language: CardLanguage) => ({
  userId,
  condition: 'NEAR_MINT' as const,
  language,
  firstEdition: false,
});

/**
 * Produits de la collection : import (avec les quantités officielles quand on les connaît),
 * liste, contenu détaillé pour les reconstituer, retrait.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly content: ProductContentService,
    private readonly progress: SetProgressService,
  ) {}

  // ─── Import ────────────────────────────────────────────────────────────────

  async importSet(userId: string, input: ImportSetInput): Promise<ImportSetResultDto> {
    const set = await this.prisma.cardSet.findUnique({
      where: { name: input.setName },
      select: { id: true, name: true },
    });
    if (!set) throw new NotFoundException(t('errors.productNotFound'));

    const verified = await this.content.ensureQuickly(set.id);
    const cards = await this.cardsOf(set.id);
    if (!cards.length) throw new NotFoundException(t('errors.productEmpty'));

    const language = await collectionLanguageOf(this.prisma, userId, input.language);
    const identity = importIdentity(userId, language);
    const existing = await this.prisma.collectionItem.findMany({
      where: { ...identity, printId: { in: cards.map((c) => c.printId) } },
      select: { id: true, printId: true },
    });
    const existingByPrint = new Map(existing.map((e) => [e.printId, e.id]));

    const product = await this.prisma.$transaction(async (tx) => {
      for (const c of cards) {
        const itemId = existingByPrint.get(c.printId);
        if (itemId) {
          await tx.collectionItem.update({
            where: { id: itemId },
            data: { quantity: { increment: c.quantity * input.copies } },
          });
        }
      }
      await tx.collectionItem.createMany({
        data: cards
          .filter((c) => !existingByPrint.has(c.printId))
          .map((c) => ({
            ...identity,
            cardId: c.cardId,
            printId: c.printId,
            quantity: c.quantity * input.copies,
          })),
      });
      return tx.ownedProduct.upsert({
        where: { userId_setId_language: { userId, setId: set.id, language } },
        create: { userId, setId: set.id, language, copies: input.copies },
        update: { copies: { increment: input.copies } },
        select: { id: true },
      });
    });

    await this.progress.afterCards(
      userId,
      cards.map((c) => c.cardId),
    );

    return {
      productId: product.id,
      set: set.name,
      cardsAdded: cards.length,
      copiesAdded: cards.reduce((s, c) => s + c.quantity, 0) * input.copies,
      quantitiesVerified: verified,
    };
  }

  // ─── Consultation ──────────────────────────────────────────────────────────

  /**
   * Les produits possédés, filtrés et triés. On en a au plus quelques dizaines : le tri se
   * fait en mémoire, sur des valeurs déjà calculées (avancement, nom localisé), plutôt qu'en
   * SQL où l'avancement n'existe pas encore.
   */
  async list(userId: string, query: OwnedProductsQueryInput = {}): Promise<OwnedProductDto[]> {
    const products = await this.prisma.ownedProduct.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, setId: true, copies: true, language: true, createdAt: true },
    });
    if (!products.length) return [];
    const setIds = products.map((p) => p.setId);
    const sets = await this.sets(setIds);
    const contents = await this.contents(setIds);
    const [owned, tags] = await Promise.all([
      this.ownership.quantities(userId, [
        ...new Set([...contents.values()].flatMap((cs) => cs.map((c) => c.cardId))),
      ]),
      this.tagsBySet(userId, setIds),
    ]);
    const all = products.flatMap((p) => {
      const set = sets.get(p.setId);
      return set
        ? [this.summary(p, set, contents.get(p.setId) ?? [], owned, tags.get(p.setId) ?? [])]
        : [];
    });
    return sortProducts(
      all.filter((product) => matches(product, query)),
      query.sort ?? 'added',
    );
  }

  async detail(userId: string, id: string): Promise<OwnedProductDetailDto> {
    const product = await this.find(userId, id);
    // Consulter un produit est l'occasion d'aller chercher ses quantités officielles
    await this.content.ensureQuickly(product.setId);
    const [sets, cards] = await Promise.all([
      this.sets([product.setId]),
      this.cardsOf(product.setId),
    ]);
    const set = sets.get(product.setId);
    if (!set) throw new NotFoundException(t('errors.productNotFound'));

    const ids = cards.map((c) => c.cardId);
    const [rows, owned] = await Promise.all([
      this.prisma.card.findMany({ where: { id: { in: ids } }, select: cardSummarySelect }),
      this.ownership.quantities(userId, ids),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const list: OwnedProductCardDto[] = cards.flatMap((c) => {
      const row = byId.get(c.cardId);
      if (!row) return [];
      const have = owned.get(c.cardId) ?? 0;
      return [
        {
          card: toCardSummary(row, have),
          printCode: c.printCode,
          rarity: c.rarity,
          quantity: c.quantity,
          needed: c.quantity * product.copies,
          owned: have,
          zone: row.isExtraDeck ? ('EXTRA' as const) : ('MAIN' as const),
        },
      ];
    });
    return { ...this.summary(product, set, cards, owned), cards: list };
  }

  /** Retire le produit ; en option, retire aussi de la collection les exemplaires qu'il avait apportés. */
  async remove(userId: string, id: string, removeCards: boolean): Promise<void> {
    const product = await this.find(userId, id);
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (removeCards) {
      const cards = await this.cardsOf(product.setId);
      const items = await this.prisma.collectionItem.findMany({
        where: { userId, cardId: { in: cards.map((c) => c.cardId) } },
        select: { id: true, cardId: true, printId: true, quantity: true, language: true },
      });
      for (const c of cards) {
        let left = c.quantity * product.copies;
        // D'abord les exemplaires ajoutés par l'import (même impression, même langue), puis les autres
        const candidates = items
          .filter((i) => i.cardId === c.cardId)
          .sort(
            (a, b) =>
              Number(b.printId === c.printId && b.language === product.language) -
              Number(a.printId === c.printId && a.language === product.language),
          );
        for (const item of candidates) {
          if (left <= 0) break;
          const take = Math.min(left, item.quantity);
          left -= take;
          ops.push(
            item.quantity - take > 0
              ? this.prisma.collectionItem.update({
                  where: { id: item.id },
                  data: { quantity: item.quantity - take },
                })
              : this.prisma.collectionItem.delete({ where: { id: item.id } }),
          );
        }
      }
    }
    ops.push(this.prisma.ownedProduct.delete({ where: { id: product.id } }));
    await this.prisma.$transaction(ops);
    if (removeCards) {
      const cards = await this.cardsOf(product.setId);
      await this.progress.afterCards(
        userId,
        cards.map((c) => c.cardId),
      );
    }
  }

  // ─── Internes ──────────────────────────────────────────────────────────────

  private async find(userId: string, id: string): Promise<ProductRow> {
    const product = await this.prisma.ownedProduct.findFirst({
      where: { id, userId },
      select: { id: true, setId: true, copies: true, language: true, createdAt: true },
    });
    if (!product) throw new NotFoundException(t('errors.productNotOwned'));
    return product;
  }

  private async cardsOf(setId: string): Promise<ProductCard[]> {
    return productCards(
      await this.prisma.cardPrint.findMany({
        where: { setId },
        select: { id: true, cardId: true, printCode: true, rarity: true, setQuantity: true },
      }),
    );
  }

  private async contents(setIds: string[]): Promise<Map<string, ProductCard[]>> {
    const prints = await this.prisma.cardPrint.findMany({
      where: { setId: { in: setIds } },
      select: {
        id: true,
        cardId: true,
        printCode: true,
        rarity: true,
        setQuantity: true,
        setId: true,
      },
    });
    const bySet = new Map<string, typeof prints>();
    for (const p of prints) bySet.set(p.setId, [...(bySet.get(p.setId) ?? []), p]);
    return new Map([...bySet].map(([id, ps]) => [id, productCards(ps)]));
  }

  private async sets(ids: string[]): Promise<Map<string, VerifiedSet>> {
    const rows = await this.prisma.$queryRaw<(SetRow & { verified: boolean })[]>`
      SELECT ${SET_DTO_COLUMNS}, (s."contentSource" IS NOT NULL) AS verified
      FROM "CardSet" s
      WHERE s.id IN (${Prisma.join(ids)})`;
    return new Map(
      rows.map((r) => [r.id, { ...r, tcgDate: r.tcgDate?.toISOString().slice(0, 10) ?? null }]),
    );
  }

  /** Étiquettes posées sur les extensions de ces produits. */
  private async tagsBySet(userId: string, setIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.prisma.setTag.findMany({
      where: { setId: { in: [...new Set(setIds)] }, tag: { userId } },
      select: { setId: true, tagId: true },
    });
    const bySet = new Map<string, string[]>();
    for (const row of rows) bySet.set(row.setId, [...(bySet.get(row.setId) ?? []), row.tagId]);
    return bySet;
  }

  private summary(
    p: ProductRow,
    set: VerifiedSet,
    cards: ProductCard[],
    owned: Map<number, number>,
    tagIds: string[] = [],
  ): OwnedProductDto {
    const needed = cards.reduce((s, c) => s + c.quantity * p.copies, 0);
    const have = cards.reduce(
      (s, c) => s + Math.min(owned.get(c.cardId) ?? 0, c.quantity * p.copies),
      0,
    );
    const { verified, ...setDto } = set;
    return {
      id: p.id,
      set: setDto,
      copies: p.copies,
      language: p.language,
      addedAt: p.createdAt.toISOString(),
      totalCards: cards.reduce((s, c) => s + c.quantity, 0),
      distinctCards: cards.length,
      quantitiesVerified: verified,
      completeness: needed ? Math.round((have / needed) * 100) / 100 : 1,
      missingCopies: needed - have,
      isDeck: isDeckProduct(set),
      tagIds,
    };
  }
}

function matches(product: OwnedProductDto, query: OwnedProductsQueryInput): boolean {
  if (query.kind && product.set.kind !== query.kind) return false;
  if (query.complete && product.completeness < 1) return false;
  if (query.q?.trim()) {
    const needle = normalize(query.q);
    const haystack = normalize(`${product.set.name} ${product.set.code ?? ''}`);
    if (needle && !haystack.includes(needle)) return false;
  }
  // Cumuler des étiquettes restreint : le produit doit porter toutes celles demandées
  if (query.tagIds?.length && !query.tagIds.every((id) => product.tagIds.includes(id))) {
    return false;
  }
  return true;
}

function sortProducts(
  products: OwnedProductDto[],
  sort: NonNullable<OwnedProductsQueryInput['sort']>,
): OwnedProductDto[] {
  const byName = (a: OwnedProductDto, b: OwnedProductDto) => a.set.name.localeCompare(b.set.name);
  switch (sort) {
    case 'name':
      return [...products].sort(byName);
    case 'date':
      return [...products].sort(
        (a, b) => (b.set.tcgDate ?? '').localeCompare(a.set.tcgDate ?? '') || byName(a, b),
      );
    // Les produits les plus entamés d'abord : c'est ce qu'il reste à reconstituer
    case 'completeness':
      return [...products].sort((a, b) => a.completeness - b.completeness || byName(a, b));
    default:
      return [...products].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || byName(a, b));
  }
}
