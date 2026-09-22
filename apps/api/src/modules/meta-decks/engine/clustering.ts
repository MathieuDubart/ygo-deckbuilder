import type { Cluster, TournamentList } from './types';

/**
 * Regroupe les listes de tournoi en archétypes par CONTENU, pas par nom :
 * "Azamina Mitsurugi Light and Darkness Ritual" et "Azamina Light and Darkness Ritual"
 * partagent leur moteur et finissent dans le même groupe.
 *
 * On compare l'ensemble des cartes (main + extra) de chaque liste, avec l'indice de Jaccard,
 * au cœur de chaque groupe (cartes présentes dans ≥ 50 % de ses listes). Les staples
 * communs à tous les decks (Ash Blossom…) pèsent peu face aux ~25 cartes du moteur.
 */
const JOIN_THRESHOLD = 0.4;
const MERGE_THRESHOLD = 0.5;

const jaccard = (a: Set<number>, b: Set<number>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

interface Group {
  lists: TournamentList[];
  engines: Set<number>[];
  core: Set<number>;
}

function computeCore(engines: Set<number>[]): Set<number> {
  const counts = new Map<number, number>();
  for (const e of engines) for (const id of e) counts.set(id, (counts.get(id) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n / engines.length >= 0.5).map(([id]) => id));
}

export function clusterLists(lists: TournamentList[]): Cluster[] {
  if (!lists.length) return [];
  const engineOf = (l: TournamentList) => new Set([...l.main, ...l.extra]);

  // 1. Affectation gloutonne (listes les plus récentes d'abord : ids décroissants)
  let groups: Group[] = [];
  for (const list of [...lists].sort((a, b) => b.id - a.id)) {
    const engine = engineOf(list);
    let best: Group | undefined;
    let bestScore = 0;
    for (const g of groups) {
      const score = jaccard(engine, g.core);
      if (score > bestScore) [best, bestScore] = [g, score];
    }
    if (best && bestScore >= JOIN_THRESHOLD) {
      best.lists.push(list);
      best.engines.push(engine);
      best.core = computeCore(best.engines);
    } else {
      groups.push({ lists: [list], engines: [engine], core: engine });
    }
  }

  // 2. Fusion des groupes dont les cœurs se ressemblent (variantes d'un même deck)
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (jaccard(groups[i]!.core, groups[j]!.core) >= MERGE_THRESHOLD) {
          const [a, b] = [groups[i]!, groups[j]!];
          a.lists.push(...b.lists);
          a.engines.push(...b.engines);
          a.core = computeCore(a.engines);
          groups = groups.filter((_, k) => k !== j);
          merged = true;
          break outer;
        }
      }
    }
  }

  const total = lists.length;
  return groups
    .map((g) => {
      const { name, variants } = nameGroup(g.lists);
      const share = g.lists.length / total;
      return { name, variants, lists: g.lists, share, tier: tierFor(share) };
    })
    .sort((a, b) => b.lists.length - a.lists.length || a.name.localeCompare(b.name));
}

/** Nom le plus fréquent (à égalité, le plus court) ; les autres deviennent des variantes. */
export function nameGroup(lists: TournamentList[]): { name: string; variants: string[] } {
  const counts = new Map<string, number>();
  for (const l of lists) {
    const n = l.name.trim();
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  return { name: sorted[0]![0], variants: sorted.slice(1, 6).map(([n]) => n) };
}

/** Tier selon la part des listes récentes. */
export function tierFor(share: number): number {
  if (share >= 0.12) return 1;
  if (share >= 0.05) return 2;
  return 3;
}
