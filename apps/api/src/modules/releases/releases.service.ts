import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CardSetDto,
  Paginated,
  ReleaseCardDto,
  ReleaseDetailDto,
  ReleaseDto,
  ReleaseFacetsDto,
  ReleaseQueryInput,
  ReleaseRarityDto,
  ReleaseSpotlightDto,
} from '@ygo/shared';
import { RECENT_RELEASE_DAYS } from '@ygo/shared';
import { PRODUCT_KIND, SET_DTO_COLUMNS } from '../../common/catalog/product-sql';
import { allTagsOn, SET_TAGS, tagIdsOf } from '../../common/catalog/tag-sql';
import { t } from '../../common/i18n/locale-context';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeProductQuery } from '../../common/search/normalize';
import { textQuery } from '../../common/search/text-search';
import { Prisma } from '../../generated/prisma/client';
import { daysUntilRelease, releaseStatus, sortRarities } from './release-progress';
import { coverSlots, filledSlots } from './release-slots';

/** Regroupe en conservant l'ordre de première apparition. */
function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** Ligne brute d'une extension : le DTO du produit, plus l'avancement de l'utilisateur. */
type ReleaseRow = Omit<CardSetDto, 'tcgDate'> & {
  tcgDate: Date | null;
  prints: number;
  cards: number;
  ownedPrints: number;
  ownedCards: number;
  copies: number;
  ownedValue: number;
  missingValue: number;
  ownedProduct: boolean;
  tagIds: string[];
  total: number;
};

/**
 * Les mêmes grandeurs s'expriment différemment selon qu'on est dans la sous-requête qui
 * sélectionne la page (les agrégats y sont encore des jointures) ou dans la requête qui
 * l'habille (ils y sont des colonnes). D'où ces deux jeux d'expressions.
 */
const SELECTING = {
  prints: Prisma.sql`COALESCE(sp.prints, 0)`,
  cards: Prisma.sql`COALESCE(sp.cards, 0)`,
  ownedPrints: Prisma.sql`COALESCE(pr."ownedPrints", 0)`,
};
const DRESSING = {
  prints: Prisma.sql`g.prints`,
  cards: Prisma.sql`g.cards`,
  ownedPrints: Prisma.sql`g."ownedPrints"`,
};
type Metrics = typeof SELECTING;

/** Littéral SQL : `CURRENT_DATE - $n` laisserait le type du paramètre ambigu pour Postgres. */
const RECENT_WINDOW = Prisma.raw(String(RECENT_RELEASE_DAYS));

/**
 * Suivi par extension : ce qu'on peut tirer d'un booster ou d'une sortie, ce qu'on en a déjà,
 * et ce qui arrive en boutique. Tout est calculé à la demande depuis la collection — rien
 * n'est stocké, donc l'avancement est juste par construction dès qu'une carte est ajoutée.
 */
@Injectable()
export class ReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, input: ReleaseQueryInput): Promise<Paginated<ReleaseDto>> {
    const rows = await this.rows(userId, {
      conditions: this.conditions(userId, input),
      sort: input.sort ?? 'date',
      limit: input.pageSize,
      offset: (input.page - 1) * input.pageSize,
    });
    const total = rows[0]?.total ?? 0;
    return {
      items: rows.map(toReleaseDto),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  /** Ce qui arrive, et ce qui vient de sortir : de quoi ne rien manquer sans chercher. */
  async spotlight(userId: string): Promise<ReleaseSpotlightDto> {
    const [upcoming, recent] = await Promise.all([
      this.rows(userId, {
        // Les plus proches d'abord : c'est la prochaine sortie qui intéresse
        conditions: [this.statusCondition('UPCOMING')],
        sort: 'soonest',
        limit: 8,
        offset: 0,
      }),
      this.rows(userId, {
        conditions: [this.statusCondition('RECENT')],
        sort: 'date',
        limit: 8,
        offset: 0,
      }),
    ]);
    return { upcoming: upcoming.map(toReleaseDto), recent: recent.map(toReleaseDto) };
  }

  /** Valeurs de filtre réellement présentes, avec leur effectif. */
  async facets(): Promise<ReleaseFacetsDto> {
    // Les facettes décrivent la même population que la liste : tout le catalogue.
    const [kinds, years, statuses] = await Promise.all([
      this.prisma.$queryRaw<{ value: string; count: number }[]>`
        SELECT ${PRODUCT_KIND} AS value, COUNT(*)::int AS count
        FROM "CardSet" s GROUP BY 1 ORDER BY count DESC`,
      this.prisma.$queryRaw<{ value: string; count: number }[]>`
        SELECT EXTRACT(YEAR FROM s."tcgDate")::text AS value, COUNT(*)::int AS count
        FROM "CardSet" s WHERE s."tcgDate" IS NOT NULL
        GROUP BY 1 ORDER BY value DESC`,
      this.prisma.$queryRaw<{ value: string; count: number }[]>`
        SELECT CASE
                 WHEN s."tcgDate" > CURRENT_DATE THEN 'UPCOMING'
                 WHEN s."tcgDate" > CURRENT_DATE - ${RECENT_WINDOW} THEN 'RECENT'
                 ELSE 'RELEASED'
               END AS value,
               COUNT(*)::int AS count
        FROM "CardSet" s GROUP BY 1`,
    ]);
    return { kinds, statuses, years };
  }

  /** Une extension carte par carte : ce qu'il y a dedans, et ce qu'on en a déjà tiré. */
  async detail(userId: string, setId: string): Promise<ReleaseDetailDto> {
    const [header] = await this.rows(userId, {
      conditions: [Prisma.sql`s.id = ${setId}`],
      sort: 'date',
      limit: 1,
      offset: 0,
    });
    if (!header) throw new NotFoundException(t('errors.productNotFound'));

    const prints = await this.prisma.cardPrint.findMany({
      where: { setId },
      select: {
        id: true,
        printCode: true,
        rarity: true,
        rarityCode: true,
        price: true,
        cardId: true,
        card: { select: cardSummarySelect },
      },
      orderBy: [{ printCode: 'asc' }, { rarity: 'asc' }],
    });
    const items = prints.length
      ? await this.prisma.collectionItem.findMany({
          where: { userId, cardId: { in: [...new Set(prints.map((p) => p.cardId))] } },
          select: { cardId: true, printId: true, quantity: true },
        })
      : [];

    const byPrint = new Map<string, number>();
    /** Exemplaires de la carte, toutes extensions confondues. */
    const byCard = new Map<number, number>();
    /** Exemplaires de la carte achetés DANS cette extension : ceux qui cochent ses cases. */
    const hereByCard = new Map<number, number>();
    const printById = new Map(prints.map((p) => [p.id, p]));
    for (const item of items) {
      byCard.set(item.cardId, (byCard.get(item.cardId) ?? 0) + item.quantity);
      if (!item.printId) continue;
      const print = printById.get(item.printId);
      if (!print) continue; // impression d'une autre extension : comptée dans `byCard` seul
      byPrint.set(item.printId, (byPrint.get(item.printId) ?? 0) + item.quantity);
      hereByCard.set(item.cardId, (hereByCard.get(item.cardId) ?? 0) + item.quantity);
    }

    // Une carte occupe autant de cases qu'elle a de numéros dans l'extension, et chaque
    // numéro peut avoir plusieurs lignes (une par rareté). On répartit donc les exemplaires
    // sur les cases, puis on redescend la réponse sur les lignes.
    const coveredByCode = new Map<string, number>();
    for (const [cardId, group] of groupBy(prints, (p) => p.cardId)) {
      const slots = [...groupBy(group, (p) => p.printCode)].map(([printCode, rows]) => ({
        printCode,
        owned: rows.reduce((sum, r) => sum + (byPrint.get(r.id) ?? 0), 0),
      }));
      for (const slot of coverSlots(slots, hereByCard.get(cardId) ?? 0)) {
        coveredByCode.set(slot.printCode, slot.covered);
      }
    }

    const cards: ReleaseCardDto[] = prints.map((print) => {
      const owned = byPrint.get(print.id) ?? 0;
      // La case est cochée, mais par un exemplaire qui n'est pas sur cette ligne : une autre
      // rareté du même numéro, ou un autre numéro de la même carte dans ce produit.
      const covered = owned > 0 ? 0 : (coveredByCode.get(print.printCode) ?? 0);
      return {
        card: toCardSummary(print.card),
        printId: print.id,
        printCode: print.printCode,
        rarity: print.rarity,
        rarityCode: print.rarityCode,
        price: toNumber(print.price),
        owned,
        ownedSameCode: covered,
        // Venus d'une autre extension, ou d'une pile saisie sans impression précise : tout
        // ce qui n'a pas été acheté ici. Ce qui vient d'ici coche une case, ce n'est pas
        // « ailleurs », même si la case n'est pas celle de cette ligne.
        ownedElsewhere: Math.max(
          0,
          (byCard.get(print.cardId) ?? 0) - (hereByCard.get(print.cardId) ?? 0),
        ),
      };
    });

    // Même règle par rareté, mais cases et exemplaires restreints à cette rareté : avoir
    // l'Ultra d'un numéro ne coche pas sa Commune, alors que trois Communes du même numéro
    // en cochent bien trois.
    const byRarity = new Map<string, ReleaseRarityDto>();
    for (const [rarity, group] of groupBy(prints, (p) => p.rarity)) {
      let slotCount = 0;
      let ownedPrints = 0;
      for (const [, rows] of groupBy(group, (p) => p.cardId)) {
        const slots = [...groupBy(rows, (p) => p.printCode)].map(([printCode, same]) => ({
          printCode,
          owned: same.reduce((sum, r) => sum + (byPrint.get(r.id) ?? 0), 0),
        }));
        const copies = slots.reduce((sum, s) => sum + s.owned, 0);
        slotCount += slots.length;
        ownedPrints += filledSlots(slots.length, copies);
      }
      byRarity.set(rarity, { rarity, prints: slotCount, ownedPrints });
    }

    return { ...toReleaseDto(header), cards, rarities: sortRarities([...byRarity.values()]) };
  }

  // ─── Requête commune ───────────────────────────────────────────────────────

  /**
   * Impressions et cartes distinctes par extension : une seule passe, réutilisée partout.
   * On compte les CODES et non les lignes, comme `SetProgressService` : une carte éditée en
   * plusieurs raretés est une seule case de la checklist.
   */
  private readonly setPrints = Prisma.sql`
    SELECT "setId",
           COUNT(DISTINCT "printCode")::int AS prints,
           COUNT(DISTINCT "cardId")::int AS cards
    FROM "CardPrint" GROUP BY "setId"`;

  private async rows(
    userId: string,
    opts: { conditions: Prisma.Sql[]; sort: SortKey; limit: number; offset: number },
  ): Promise<ReleaseRow[]> {
    // Toutes les extensions du catalogue sont listées, y compris celles dont on ne connaît
    // encore aucune carte : l'intérêt de l'onglet est de les avoir toutes sous les yeux.
    const conditions = opts.conditions.length ? opts.conditions : [Prisma.sql`TRUE`];
    return this.prisma.$queryRaw<ReleaseRow[]>`
      WITH sp AS (${this.setPrints}),
      g AS (
        SELECT s.id,
               ${SELECTING.prints} AS prints,
               ${SELECTING.cards} AS cards,
               ${SELECTING.ownedPrints} AS "ownedPrints",
               COALESCE(pr."ownedCards", 0) AS "ownedCards",
               COALESCE(pr.copies, 0) AS copies,
               (COUNT(*) OVER ())::int AS total
        FROM "CardSet" s
        LEFT JOIN sp ON sp."setId" = s.id
        -- Avancement déjà calculé (SetProgressService) : pas d'agrégat à rejouer ici
        LEFT JOIN "SetProgress" pr ON pr."setId" = s.id AND pr."userId" = ${userId}
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY ${orderBy(opts.sort, SELECTING)}
        LIMIT ${opts.limit} OFFSET ${opts.offset}
      )
      SELECT ${SET_DTO_COLUMNS},
             g.prints, g.cards, g."ownedPrints", g."ownedCards", g.copies, g.total,
             (SELECT COALESCE(SUM(ci.quantity * COALESCE(p.price, c."priceCardmarket")), 0)::float
              FROM "CollectionItem" ci
              JOIN "CardPrint" p ON p.id = ci."printId"
              JOIN "Card" c ON c.id = ci."cardId"
              WHERE ci."userId" = ${userId} AND p."setId" = s.id
             ) AS "ownedValue",
             (SELECT COALESCE(SUM(COALESCE(p.price, c."priceCardmarket")), 0)::float
              FROM "CardPrint" p JOIN "Card" c ON c.id = p."cardId"
              WHERE p."setId" = s.id
                AND NOT EXISTS (SELECT 1 FROM "CollectionItem" ci
                                WHERE ci."userId" = ${userId} AND ci."printId" = p.id)
             ) AS "missingValue",
             EXISTS (SELECT 1 FROM "OwnedProduct" op
                     WHERE op."setId" = s.id AND op."userId" = ${userId}) AS "ownedProduct",
             ${tagIdsOf(Prisma.sql`s.id`, SET_TAGS, userId)} AS "tagIds"
      FROM g JOIN "CardSet" s ON s.id = g.id
      ORDER BY ${orderBy(opts.sort, DRESSING)}`;
  }

  private conditions(userId: string, input: ReleaseQueryInput): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [];
    if (input.q?.trim()) {
      const text = textQuery(input.q, Prisma.sql`s."searchText"`, normalizeProductQuery(input.q));
      if (text) conditions.push(text.strict);
    }
    if (input.kind) conditions.push(Prisma.sql`${PRODUCT_KIND} = ${input.kind}`);
    if (input.status) conditions.push(this.statusCondition(input.status));
    if (input.year) {
      conditions.push(Prisma.sql`EXTRACT(YEAR FROM s."tcgDate") = ${input.year}`);
    }
    if (input.ownedProduct) {
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "OwnedProduct" op
        WHERE op."setId" = s.id AND op."userId" = ${userId})`);
    }
    if (input.progress) {
      const owned = SELECTING.ownedPrints;
      const prints = SELECTING.prints;
      if (input.progress === 'NONE') conditions.push(Prisma.sql`${owned} = 0`);
      if (input.progress === 'STARTED') {
        conditions.push(Prisma.sql`${owned} > 0 AND ${owned} < ${prints}`);
      }
      if (input.progress === 'COMPLETE') {
        conditions.push(Prisma.sql`${prints} > 0 AND ${owned} >= ${prints}`);
      }
    }
    if (input.tagIds?.length) {
      conditions.push(allTagsOn(Prisma.sql`s.id`, SET_TAGS, userId, input.tagIds));
    }
    return conditions;
  }

  /** Même découpage que `releaseStatus`, mais évalué par Postgres. */
  private statusCondition(status: 'UPCOMING' | 'RECENT' | 'RELEASED'): Prisma.Sql {
    switch (status) {
      case 'UPCOMING':
        return Prisma.sql`s."tcgDate" > CURRENT_DATE`;
      case 'RECENT':
        return Prisma.sql`s."tcgDate" <= CURRENT_DATE
          AND s."tcgDate" > CURRENT_DATE - ${RECENT_WINDOW}`;
      default:
        return Prisma.sql`(s."tcgDate" IS NULL OR s."tcgDate" <= CURRENT_DATE - ${RECENT_WINDOW})`;
    }
  }
}

type SortKey = NonNullable<ReleaseQueryInput['sort']> | 'soonest';

function orderBy(sort: SortKey, m: Metrics): Prisma.Sql {
  switch (sort) {
    case 'soonest':
      return Prisma.sql`s."tcgDate" ASC, s.name`;
    case 'name':
      return Prisma.sql`s.name`;
    case 'cards':
      return Prisma.sql`${m.cards} DESC, s.name`;
    case 'progress':
      return Prisma.sql`${m.ownedPrints}::float / NULLIF(${m.prints}, 0) DESC NULLS LAST,
        ${m.ownedPrints} DESC, s.name`;
    default:
      return Prisma.sql`s."tcgDate" DESC NULLS LAST, s.name`;
  }
}

function toReleaseDto(row: ReleaseRow): ReleaseDto {
  const today = new Date();
  const { prints, cards, ownedPrints, ownedCards, copies } = row;
  return {
    set: {
      id: row.id,
      name: row.name,
      code: row.code,
      tcgDate: row.tcgDate?.toISOString().slice(0, 10) ?? null,
      kind: row.kind,
      imageUrl: row.imageUrl,
      fallbackImageUrl: row.fallbackImageUrl,
      cardCount: row.cardCount,
    },
    status: releaseStatus(row.tcgDate, today),
    daysUntil: daysUntilRelease(row.tcgDate, today),
    progress: { prints, cards, ownedPrints, ownedCards, copies },
    ownedProduct: row.ownedProduct,
    ownedValue: row.ownedValue,
    missingValue: row.missingValue,
    tagIds: row.tagIds,
  };
}
