import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CardDetailDto,
  CardSearchInput,
  CardSetDto,
  CardSummaryDto,
  Paginated,
  SetSearchInput,
} from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardSummarySelect, toCardDetail, toCardSummary } from '../../common/mappers/card.mapper';
import { normalizeProductQuery, parsePrintCode } from '../../common/search/normalize';
import { textQuery } from '../../common/search/text-search';
import { Prisma } from '../../generated/prisma/client';
import { OwnershipService } from '../collection/ownership.service';

/** Type de produit déduit du nom normalisé (YGOPRODeck ne le fournit pas). */
const PRODUCT_KIND = Prisma.sql`CASE
  WHEN s."searchText" ~ '(^| )(structure deck|structure decks)( |$)' THEN 'STRUCTURE'
  WHEN s."searchText" ~ '(^| )(mega )?tins?( |$)' THEN 'TIN'
  WHEN s."searchText" ~ '(^| )starter decks?( |$)' THEN 'STARTER'
  WHEN s."searchText" ~ '(^| )(box|collection|legendary decks|chronicles deck|anniversary pack)( |$)' THEN 'BOX'
  ELSE 'OTHER' END`;

/** Nom affiché = nom FR s'il existe. On trie sur sa forme normalisée (É = E). */
const DISPLAY_NAME = Prisma.sql`ygo_normalize(coalesce(c."nameFr", c."name"))`;

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  /**
   * Recherche en SQL brut : Prisma ne sait pas exprimer le matching trigramme ni le tri
   * par pertinence. On récupère les ids paginés, puis les cartes via Prisma.
   */
  async search(input: CardSearchInput, userId?: string): Promise<Paginated<CardSummaryDto>> {
    // "SDBE-FR001" (code imprimé sur la carte) → recherche par impression, pas par nom
    const printCode = input.q ? parsePrintCode(input.q) : null;
    const text = input.q && !printCode ? textQuery(input.q, Prisma.sql`c."searchText"`) : null;
    const filters = this.filters(input, userId);
    if (printCode) filters.push(this.printCodeFilter(printCode));

    let approximate = false;
    let where = this.where([...filters, ...(text ? [text.strict] : [])]);
    let total = await this.count(where);

    // Aucun résultat exact → on retente en tolérant les fautes de frappe.
    if (total === 0 && text && text.normalized.length >= 3) {
      where = this.where([...filters, text.fuzzy]);
      total = await this.count(where);
      approximate = total > 0;
    }

    const offset = (input.page - 1) * input.pageSize;
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c.id FROM "Card" c
      ${where}
      ORDER BY ${this.orderBy(input.sort ?? (text ? 'relevance' : 'name'), text)}
      LIMIT ${input.pageSize} OFFSET ${offset}`;
    const ids = rows.map((r) => r.id);

    const [cards, owned] = await Promise.all([
      this.prisma.card.findMany({ where: { id: { in: ids } }, select: cardSummarySelect }),
      userId ? this.ownership.quantities(userId, ids) : undefined,
    ]);
    const byId = new Map(cards.map((c) => [c.id, c]));

    return {
      items: ids
        .map((id) => byId.get(id))
        .filter((c) => c !== undefined)
        .map((c) => toCardSummary(c, owned ? (owned.get(c.id) ?? 0) : undefined)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
      ...(approximate && { approximate }),
    };
  }

  async findOne(id: number, userId?: string): Promise<CardDetailDto> {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { prints: { include: { set: true }, orderBy: { printCode: 'asc' } } },
    });
    if (!card) throw new NotFoundException('Carte introuvable');
    const owned = userId
      ? ((await this.ownership.quantities(userId, [id])).get(id) ?? 0)
      : undefined;
    return toCardDetail(card, owned);
  }

  async archetypes(): Promise<string[]> {
    const rows = await this.prisma.card.findMany({
      where: { archetype: { not: null } },
      distinct: ['archetype'],
      select: { archetype: true },
      orderBy: { archetype: 'asc' },
    });
    return rows.map((r) => r.archetype!);
  }

  /**
   * Produits (structure decks, tins, boosters…) avec leur visuel, pour les retrouver à l'œil.
   * Seuls les sets qui contiennent réellement des cartes sont proposés.
   * Accepte les termes FR ("boîte", "deck de structure") et les codes ("SDBE", "SDBE-FR001").
   */
  async sets(input: SetSearchInput): Promise<CardSetDto[]> {
    let q = input.q;
    const code = q ? parsePrintCode(q) : null;
    if (code) q = code.set;
    const text = q?.trim()
      ? textQuery(q, Prisma.sql`s."searchText"`, normalizeProductQuery(q))
      : null;

    const conditions = [
      Prisma.sql`EXISTS (SELECT 1 FROM "CardPrint" p WHERE p."setId" = s.id)`,
      ...(text ? [text.strict] : []),
      ...(input.kind ? [Prisma.sql`${PRODUCT_KIND} = ${input.kind}`] : []),
    ];

    const rows = await this.prisma.$queryRaw<
      (Omit<CardSetDto, 'tcgDate'> & { tcgDate: Date | null })[]
    >`
      SELECT s.id, s.name, s.code, s."tcgDate",
             ${PRODUCT_KIND} AS kind,
             COALESCE(s."imageUrl", (
               SELECT c."imageUrlSmall" FROM "CardPrint" p JOIN "Card" c ON c.id = p."cardId"
               WHERE p."setId" = s.id AND c."imageUrlSmall" IS NOT NULL
               ORDER BY p."printCode" LIMIT 1
             )) AS "imageUrl",
             (SELECT COUNT(DISTINCT p."cardId")::int FROM "CardPrint" p WHERE p."setId" = s.id) AS "cardCount"
      FROM "CardSet" s
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ${text ? Prisma.sql`${text.similarity} DESC,` : Prisma.empty} s."tcgDate" DESC NULLS LAST, s.name
      LIMIT 60`;
    // Pas de repli flou ici : sur des noms de produits, il remonte surtout du bruit.

    return rows.map((r) => ({ ...r, tcgDate: r.tcgDate?.toISOString().slice(0, 10) ?? null }));
  }

  private filters(i: CardSearchInput, userId?: string): Prisma.Sql[] {
    const f: Prisma.Sql[] = [];
    if (i.category) f.push(Prisma.sql`c.category = ${i.category}::"CardCategory"`);
    if (i.archetype) f.push(Prisma.sql`lower(c.archetype) = lower(${i.archetype})`);
    if (i.attribute) f.push(Prisma.sql`lower(c.attribute) = lower(${i.attribute})`);
    if (i.race) f.push(Prisma.sql`lower(c.race) = lower(${i.race})`);
    if (i.levelMin !== undefined) f.push(Prisma.sql`c.level >= ${i.levelMin}`);
    if (i.levelMax !== undefined) f.push(Prisma.sql`c.level <= ${i.levelMax}`);
    if (i.setName) {
      f.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "CardPrint" p JOIN "CardSet" s ON s.id = p."setId"
        WHERE p."cardId" = c.id AND s.name = ${i.setName})`);
    }
    if (i.owned && userId) {
      f.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "CollectionItem" ci WHERE ci."cardId" = c.id AND ci."userId" = ${userId})`);
    }
    return f;
  }

  /** Même set + même numéro, quelle que soit la langue (EN, FR, E, sans région…). */
  private printCodeFilter(code: { set: string; number: string }): Prisma.Sql {
    return Prisma.sql`EXISTS (
      SELECT 1 FROM "CardPrint" p
      WHERE p."cardId" = c.id
        AND upper(split_part(p."printCode", '-', 1)) = ${code.set}
        AND regexp_replace(split_part(p."printCode", '-', 2), '^[A-Za-z]*', '') = ${code.number})`;
  }

  private where(conditions: Prisma.Sql[]): Prisma.Sql {
    return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
  }

  private async count(where: Prisma.Sql): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "Card" c ${where}`;
    return row?.n ?? 0;
  }

  private orderBy(
    sort: NonNullable<CardSearchInput['sort']>,
    text: ReturnType<typeof textQuery>,
  ): Prisma.Sql {
    switch (sort) {
      case 'relevance': {
        if (!text) return Prisma.sql`${DISPLAY_NAME}`;
        const n = text.normalized;
        // exact > commence par > contient, puis similarité, puis noms courts d'abord
        return Prisma.sql`
          CASE
            WHEN ${DISPLAY_NAME} = ${n} OR ygo_normalize(c.name) = ${n} THEN 0
            WHEN ${DISPLAY_NAME} LIKE ${n + '%'} OR ygo_normalize(c.name) LIKE ${n + '%'} THEN 1
            ELSE 2
          END,
          ${text.similarity} DESC,
          length(coalesce(c."nameFr", c.name)),
          ${DISPLAY_NAME}`;
      }
      case 'atk':
        return Prisma.sql`c.atk DESC NULLS LAST, ${DISPLAY_NAME}`;
      case 'def':
        return Prisma.sql`c.def DESC NULLS LAST, ${DISPLAY_NAME}`;
      case 'level':
        return Prisma.sql`c.level DESC NULLS LAST, ${DISPLAY_NAME}`;
      case 'newest':
        return Prisma.sql`c."tcgDate" DESC NULLS LAST, ${DISPLAY_NAME}`;
      default:
        return Prisma.sql`${DISPLAY_NAME}`;
    }
  }
}
