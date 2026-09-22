import type { CardDetailDto, CardPrintDto, CardSummaryDto } from '@ygo/shared';
import type { AppLocale } from '@ygo/shared';
import type { Prisma } from '../../generated/prisma/client';
import { currentLocale } from '../i18n/locale-context';

type Decimalish = Prisma.Decimal | null | undefined;
export const toNumber = (d: Decimalish): number | null => (d == null ? null : Number(d));

/** Sélection Prisma minimale pour construire un CardSummaryDto (évite de charger `desc` inutilement). */
export const cardSummarySelect = {
  id: true,
  name: true,
  nameFr: true,
  category: true,
  type: true,
  frameType: true,
  archetype: true,
  attribute: true,
  race: true,
  level: true,
  atk: true,
  def: true,
  imageUrl: true,
  imageUrlSmall: true,
  isExtraDeck: true,
  banTcg: true,
  priceCardmarket: true,
  // Noms allemand / italien / portugais (le français est dans nameFr)
  translations: { select: { locale: true, name: true } },
} satisfies Prisma.CardSelect;

export type CardSummaryRow = Prisma.CardGetPayload<{ select: typeof cardSummarySelect }>;

export function toCardSummary(card: CardSummaryRow, ownedQuantity?: number): CardSummaryDto {
  return {
    id: card.id,
    name: localizedName(card),
    category: card.category,
    type: card.type,
    frameType: card.frameType,
    archetype: card.archetype,
    attribute: card.attribute,
    race: card.race,
    level: card.level,
    atk: card.atk,
    def: card.def,
    imageUrl: card.imageUrl,
    imageUrlSmall: card.imageUrlSmall,
    isExtraDeck: card.isExtraDeck,
    banTcg: card.banTcg,
    priceCardmarket: toNumber(card.priceCardmarket),
    ...(ownedQuantity !== undefined && { ownedQuantity }),
  };
}

type CardDetailRow = Prisma.CardGetPayload<{
  include: { prints: { include: { set: true } }; translations: true };
}>;

/** Nom de la carte dans la langue de la requête (anglais si pas de traduction). */
export function localizedName(
  card: Pick<CardSummaryRow, 'name' | 'nameFr'> & {
    translations?: { locale: string; name: string }[];
  },
  locale: AppLocale = currentLocale(),
): string {
  if (locale === 'en') return card.name;
  if (locale === 'fr') return card.nameFr ?? card.name;
  return card.translations?.find((t) => t.locale === locale)?.name ?? card.name;
}

function localizedDesc(card: CardDetailRow, locale: AppLocale = currentLocale()): string {
  if (locale === 'en') return card.desc;
  if (locale === 'fr') return card.descFr ?? card.desc;
  return card.translations.find((t) => t.locale === locale)?.desc ?? card.desc;
}

export function toCardDetail(card: CardDetailRow, ownedQuantity?: number): CardDetailDto {
  return {
    ...toCardSummary(card, ownedQuantity),
    desc: localizedDesc(card),
    linkVal: card.linkVal,
    linkMarkers: card.linkMarkers,
    scale: card.scale,
    banOcg: card.banOcg,
    prints: card.prints.map((p): CardPrintDto => ({
      id: p.id,
      setCode: p.set.code,
      setName: p.set.name,
      printCode: p.printCode,
      rarity: p.rarity,
      rarityCode: p.rarityCode,
      price: toNumber(p.price),
    })),
  };
}
