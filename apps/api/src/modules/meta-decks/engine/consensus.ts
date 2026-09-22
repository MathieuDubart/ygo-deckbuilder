import { countCopies } from './stats';
import type { DeckTemplate, TemplateCard, TournamentList, Zone } from './types';

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};

/** Nombre d'exemplaires le plus fréquent (à égalité, le plus élevé). */
const mode = (xs: number[]) => {
  const c = countCopies(xs);
  return [...c].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
};

/**
 * Construit la liste "type" d'un archétype à partir de ses listes de tournoi :
 * on prend les cartes par taux d'inclusion décroissant, au nombre d'exemplaires
 * le plus joué, jusqu'à la taille médiane des listes.
 */
export function buildConsensus(lists: TournamentList[]): DeckTemplate {
  const n = lists.length;
  const zones: Record<Zone, (l: TournamentList) => number[]> = {
    MAIN: (l) => l.main,
    EXTRA: (l) => l.extra,
    SIDE: (l) => l.side,
  };
  const targets: Record<Zone, number> = {
    MAIN: Math.min(60, Math.max(40, median(lists.map((l) => l.main.length)))),
    EXTRA: Math.min(15, median(lists.map((l) => l.extra.length))),
    SIDE: Math.min(15, median(lists.map((l) => l.side.length))),
  };

  const cards: TemplateCard[] = [];
  const flex: TemplateCard[] = [];

  for (const zone of ['MAIN', 'EXTRA', 'SIDE'] as const) {
    const copiesByCard = new Map<number, number[]>();
    for (const l of lists) {
      for (const [id, c] of countCopies(zones[zone](l))) {
        copiesByCard.set(id, [...(copiesByCard.get(id) ?? []), c]);
      }
    }
    const candidates = [...copiesByCard]
      .map(([cardId, copies]) => ({
        cardId,
        zone,
        quantity: mode(copies),
        inclusion: copies.length / n,
        avg: copies.reduce((a, b) => a + b, 0) / copies.length,
      }))
      .sort((a, b) => b.inclusion - a.inclusion || b.avg - a.avg || a.cardId - b.cardId);

    let room = targets[zone];
    for (const { avg: _avg, ...c } of candidates) {
      if (room > 0) {
        const q = Math.min(c.quantity, room);
        cards.push({ ...c, quantity: q });
        room -= q;
      } else if (c.inclusion >= 0.1) {
        flex.push(c);
      }
    }
  }

  return { cards, flex, mainSize: targets.MAIN };
}
