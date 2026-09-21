import type { YgoCard, YgoCardSet } from './ygoprodeck.types';

export type Category = 'MONSTER' | 'SPELL' | 'TRAP' | 'SKILL' | 'TOKEN';

const EXTRA_DECK_FRAMES = ['fusion', 'synchro', 'xyz', 'link'];

export function categoryOf(card: Pick<YgoCard, 'type' | 'frameType'>): Category {
  const t = card.type.toLowerCase();
  if (t.includes('spell')) return 'SPELL';
  if (t.includes('trap')) return 'TRAP';
  if (t.includes('skill')) return 'SKILL';
  if (t === 'token' || card.frameType === 'token') return 'TOKEN';
  return 'MONSTER';
}

export const isExtraDeck = (frameType: string): boolean =>
  EXTRA_DECK_FRAMES.some((f) => frameType.startsWith(f));

/** YGOPRODeck renvoie les prix en string ; "0" / "0.00" = pas de prix connu. */
export function parsePrice(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}

export function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Données "Card" prêtes pour Prisma (sans les relations). */
export function mapCard(c: YgoCard, fr?: { name: string; desc: string }) {
  const image = c.card_images?.find((i) => i.id === c.id) ?? c.card_images?.[0];
  const prices = c.card_prices?.[0];
  const misc = c.misc_info?.[0];
  return {
    id: c.id,
    name: c.name,
    nameFr: fr?.name && fr.name !== c.name ? fr.name : null,
    descFr: fr?.desc && fr.desc !== c.desc ? fr.desc : null,
    category: categoryOf(c),
    type: c.type,
    frameType: c.frameType,
    desc: c.desc,
    archetype: c.archetype ?? null,
    attribute: c.attribute ?? null,
    race: c.race ?? null,
    level: c.level ?? null,
    atk: c.atk ?? null,
    def: c.def ?? null,
    linkVal: c.linkval ?? null,
    linkMarkers: c.linkmarkers ?? [],
    scale: c.scale ?? null,
    isExtraDeck: isExtraDeck(c.frameType),
    banTcg: c.banlist_info?.ban_tcg ?? null,
    banOcg: c.banlist_info?.ban_ocg ?? null,
    formats: misc?.formats ?? [],
    tcgDate: parseDate(misc?.tcg_date),
    imageUrl: image?.image_url ?? null,
    imageUrlSmall: image?.image_url_small ?? null,
    priceCardmarket: parsePrice(prices?.cardmarket_price),
    priceTcgplayer: parsePrice(prices?.tcgplayer_price),
  };
}

export function mapPrint(cardId: number, s: YgoCardSet) {
  return {
    cardId,
    printCode: s.set_code,
    rarity: s.set_rarity,
    rarityCode: s.set_rarity_code?.replace(/[()]/g, '') || null,
    price: parsePrice(s.set_price),
  };
}

/** "LOB-EN001" → "LOB" */
export const setPrefixOf = (printCode: string): string | null => printCode.split('-')[0] || null;
