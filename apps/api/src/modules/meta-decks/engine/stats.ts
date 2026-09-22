import type { CardStat, TournamentList } from './types';

export const countCopies = (ids: number[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
};

/**
 * Popularité de chaque carte sur l'ensemble des listes (main + extra).
 * Une carte jouée par une grande partie de TOUS les archétypes est un "staple"
 * (Ash Blossom, Nibiru, Called by…) : elle ne caractérise pas un deck.
 */
export function cardStats(lists: TournamentList[]): Map<number, CardStat> {
  const seen = new Map<number, { decks: number; copies: number }>();
  for (const l of lists) {
    for (const [id, copies] of countCopies([...l.main, ...l.extra])) {
      const s = seen.get(id) ?? { decks: 0, copies: 0 };
      s.decks += 1;
      s.copies += copies;
      seen.set(id, s);
    }
  }
  const total = Math.max(lists.length, 1);
  return new Map(
    [...seen].map(([id, s]) => [id, { share: s.decks / total, avgCopies: s.copies / s.decks }]),
  );
}

/**
 * Staples = cartes jouées par PLUSIEURS archétypes différents (≥ 30 % des listes de chacun),
 * dans au moins 2 archétypes et 20 % d'entre eux. C'est ce qui distingue Ash Blossom
 * (partout) d'une carte moteur très jouée parce que son deck domine le meta.
 */
export function crossArchetypeStaples(groups: TournamentList[][]): Set<number> {
  const presentIn = new Map<number, number>();
  for (const lists of groups) {
    for (const [id, s] of cardStats(lists)) {
      if (s.share >= 0.3) presentIn.set(id, (presentIn.get(id) ?? 0) + 1);
    }
  }
  const needed = Math.max(2, Math.ceil(groups.length * 0.2));
  return new Set([...presentIn].filter(([, n]) => n >= needed).map(([id]) => id));
}
