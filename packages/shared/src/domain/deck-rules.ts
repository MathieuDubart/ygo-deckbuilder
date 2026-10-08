import type { DeckFormat, DeckZone } from './enums';

/** Règles officielles de construction (TCG/OCG). */
export const DECK_RULES = {
  MAIN: { min: 40, max: 60 },
  EXTRA: { min: 0, max: 15 },
  SIDE: { min: 0, max: 15 },
  MAX_COPIES: 3,
} as const;

/**
 * Statut banlist, normalisé. Les sources ne s'accordent pas sur les libellés — YGOPRODeck
 * écrit « Banned », Konami « Forbidden », et on croise « Semi-Limited » comme « Semi Limited »
 * — alors qu'il n'existe que trois statuts. On normalise à l'entrée, une fois.
 */
export type BanStatus = 'FORBIDDEN' | 'LIMITED' | 'SEMI_LIMITED';

/**
 * Exemplaires autorisés par statut. La limite porte sur le deck ENTIER : Main + Extra + Side
 * confondus. C'est ce qui fait qu'envoyer une carte au Side ne répare jamais un dépassement.
 */
export const BANLIST_LIMITS: Record<BanStatus, number> = {
  FORBIDDEN: 0,
  LIMITED: 1,
  SEMI_LIMITED: 2,
};

/** Libellé brut d'une source → statut, ou `null` si la carte n'est pas sur la liste. */
export function banStatusOf(label: string | null | undefined): BanStatus | null {
  if (!label) return null;
  switch (label.trim().toLowerCase().replace(/[\s_]+/g, '-')) {
    case 'banned':
    case 'forbidden':
      return 'FORBIDDEN';
    case 'limited':
      return 'LIMITED';
    case 'semi-limited':
      return 'SEMI_LIMITED';
    default:
      return null;
  }
}

export function maxCopiesFor(banStatus: string | null | undefined): number {
  const status = banStatusOf(banStatus);
  return status ? BANLIST_LIMITS[status] : DECK_RULES.MAX_COPIES;
}

/**
 * La banlist qui s'applique à une carte dans un deck donné : celle de son format. Les deux
 * listes divergent — une carte limitée en TCG peut être libre en OCG — donc se tromper de
 * colonne interdit des cartes légales, ou laisse passer des cartes interdites.
 */
export function banStatusForFormat(
  card: { banTcg: string | null; banOcg: string | null },
  format: DeckFormat,
): string | null {
  return format === 'OCG' ? card.banOcg : card.banTcg;
}

export type DeckIssue =
  | { code: 'ZONE_TOO_SMALL' | 'ZONE_TOO_LARGE'; zone: DeckZone; count: number; limit: number }
  /** Carte interdite : ce n'est pas « trop d'exemplaires », c'est zéro exemplaire autorisé. */
  | { code: 'FORBIDDEN'; cardId: number; count: number }
  | { code: 'TOO_MANY_COPIES'; cardId: number; count: number; limit: number }
  | { code: 'WRONG_ZONE'; cardId: number; zone: DeckZone };

export interface DeckEntryForValidation {
  cardId: number;
  zone: DeckZone;
  quantity: number;
  isExtraDeckMonster: boolean;
  banStatus?: string | null;
}

/**
 * Validation pure (sans I/O) d'une decklist — utilisée côté API ET côté web
 * pour un feedback instantané dans le builder.
 */
export function validateDeck(entries: DeckEntryForValidation[]): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const zoneCounts: Record<DeckZone, number> = { MAIN: 0, EXTRA: 0, SIDE: 0 };

  for (const e of entries) {
    zoneCounts[e.zone] += e.quantity;
    if (e.zone === 'MAIN' && e.isExtraDeckMonster) {
      issues.push({ code: 'WRONG_ZONE', cardId: e.cardId, zone: e.zone });
    }
    if (e.zone === 'EXTRA' && !e.isExtraDeckMonster) {
      issues.push({ code: 'WRONG_ZONE', cardId: e.cardId, zone: e.zone });
    }
  }

  for (const zone of ['MAIN', 'EXTRA', 'SIDE'] as const) {
    const { min, max } = DECK_RULES[zone];
    const count = zoneCounts[zone];
    if (count < min) issues.push({ code: 'ZONE_TOO_SMALL', zone, count, limit: min });
    if (count > max) issues.push({ code: 'ZONE_TOO_LARGE', zone, count, limit: max });
  }

  for (const { cardId, count, limit } of copiesPerCard(entries)) {
    if (count <= limit) continue;
    if (limit === 0) issues.push({ code: 'FORBIDDEN', cardId, count });
    else issues.push({ code: 'TOO_MANY_COPIES', cardId, count, limit });
  }

  return issues;
}

/** Un exemplaire à retirer d'une zone précise. */
export interface BanlistFix {
  cardId: number;
  zone: DeckZone;
  remove: number;
}

/**
 * Ordre dans lequel on sacrifie les exemplaires en trop. Le Side d'abord : c'est la réserve,
 * la retoucher ne défait pas le deck qu'on joue. Puis l'Extra, puis le Main en dernier.
 */
const TRIM_ORDER: readonly DeckZone[] = ['SIDE', 'EXTRA', 'MAIN'];

/**
 * Ce qu'il faut retirer pour qu'une decklist repasse la banlist, et rien d'autre : une carte
 * trop jouée perd juste ses exemplaires au-delà de la limite, une carte interdite part en
 * entier. On ne déplace rien vers le Side — la limite compte le deck entier, donc déplacer un
 * exemplaire ne le fait pas disparaître du total.
 *
 * Le résultat est déterministe à entrées égales : c'est ce que le bouton « corriger » applique,
 * et il doit donner la même chose sur le web et sur iOS.
 */
export function banlistFixes(entries: DeckEntryForValidation[]): BanlistFix[] {
  const fixes: BanlistFix[] = [];

  for (const { cardId, count, limit } of copiesPerCard(entries)) {
    let excess = count - limit;
    if (excess <= 0) continue;
    for (const zone of TRIM_ORDER) {
      if (excess <= 0) break;
      const inZone = entries
        .filter((e) => e.cardId === cardId && e.zone === zone)
        .reduce((sum, e) => sum + e.quantity, 0);
      if (inZone <= 0) continue;
      const remove = Math.min(inZone, excess);
      fixes.push({ cardId, zone, remove });
      excess -= remove;
    }
  }

  return fixes;
}

/**
 * Exemplaires par carte, toutes zones confondues, avec la limite qui s'applique. La limite est
 * prise au premier statut rencontré pour la carte : c'est la même carte, les entrées ne peuvent
 * pas se contredire.
 */
function copiesPerCard(
  entries: DeckEntryForValidation[],
): { cardId: number; count: number; limit: number }[] {
  const copies = new Map<number, { count: number; limit: number }>();
  for (const e of entries) {
    const prev = copies.get(e.cardId);
    copies.set(e.cardId, {
      count: (prev?.count ?? 0) + e.quantity,
      limit: prev?.limit ?? maxCopiesFor(e.banStatus),
    });
  }
  return [...copies].map(([cardId, c]) => ({ cardId, ...c }));
}
