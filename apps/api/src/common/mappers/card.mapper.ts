import type { CardDetailDto, CardPrintDto, CardSummaryDto } from '@ygo/shared';
import type { Prisma } from '../../generated/prisma/client';

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
  imageUrlSmall: true,
  isExtraDeck: true,
  banTcg: true,
  priceCardmarket: true,
} satisfies Prisma.CardSelect;

export type CardSummaryRow = Prisma.CardGetPayload<{ select: typeof cardSummarySelect }>;

export function toCardSummary(card: CardSummaryRow, ownedQuantity?: number): CardSummaryDto {
  return {
    id: card.id,
    name: card.nameFr ?? card.name,
    category: card.category,
    type: card.type,
    frameType: card.frameType,
    archetype: card.archetype,
    attribute: card.attribute,
    race: card.race,
    level: card.level,
    atk: card.atk,
    def: card.def,
    imageUrlSmall: card.imageUrlSmall,
    isExtraDeck: card.isExtraDeck,
    banTcg: card.banTcg,
    priceCardmarket: toNumber(card.priceCardmarket),
    ...(ownedQuantity !== undefined && { ownedQuantity }),
  };
}

type CardDetailRow = Prisma.CardGetPayload<{ include: { prints: { include: { set: true } } } }>;

export function toCardDetail(card: CardDetailRow, ownedQuantity?: number): CardDetailDto {
  return {
    ...toCardSummary(card, ownedQuantity),
    desc: card.descFr ?? card.desc,
    imageUrl: card.imageUrl,
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
