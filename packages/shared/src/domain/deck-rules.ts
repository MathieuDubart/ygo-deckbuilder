import type { DeckZone } from './enums';

/** Règles officielles de construction (TCG/OCG). */
export const DECK_RULES = {
  MAIN: { min: 40, max: 60 },
  EXTRA: { min: 0, max: 15 },
  SIDE: { min: 0, max: 15 },
  MAX_COPIES: 3,
} as const;

/** Nombre d'exemplaires autorisés selon le statut banlist. */
export const BANLIST_LIMITS: Record<string, number> = {
  Banned: 0,
  Forbidden: 0,
  Limited: 1,
  'Semi-Limited': 2,
};

export function maxCopiesFor(banStatus: string | null | undefined): number {
  if (!banStatus) return DECK_RULES.MAX_COPIES;
  return BANLIST_LIMITS[banStatus] ?? DECK_RULES.MAX_COPIES;
}

export type DeckIssue =
  | { code: 'ZONE_TOO_SMALL' | 'ZONE_TOO_LARGE'; zone: DeckZone; count: number; limit: number }
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
  const copies = new Map<number, { count: number; limit: number }>();

  for (const e of entries) {
    zoneCounts[e.zone] += e.quantity;
    if (e.zone === 'MAIN' && e.isExtraDeckMonster) {
      issues.push({ code: 'WRONG_ZONE', cardId: e.cardId, zone: e.zone });
    }
    if (e.zone === 'EXTRA' && !e.isExtraDeckMonster) {
      issues.push({ code: 'WRONG_ZONE', cardId: e.cardId, zone: e.zone });
    }
    const prev = copies.get(e.cardId);
    copies.set(e.cardId, {
      count: (prev?.count ?? 0) + e.quantity,
      limit: maxCopiesFor(e.banStatus),
    });
  }

  for (const zone of ['MAIN', 'EXTRA', 'SIDE'] as const) {
    const { min, max } = DECK_RULES[zone];
    const count = zoneCounts[zone];
    if (count < min) issues.push({ code: 'ZONE_TOO_SMALL', zone, count, limit: min });
    if (count > max) issues.push({ code: 'ZONE_TOO_LARGE', zone, count, limit: max });
  }

  for (const [cardId, { count, limit }] of copies) {
    if (count > limit) issues.push({ code: 'TOO_MANY_COPIES', cardId, count, limit });
  }

  return issues;
}
