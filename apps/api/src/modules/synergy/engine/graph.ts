import { matches, parseCard } from './parse';
import type { CardFeatures, Materials, Role, SummonMechanic, SynCard, Verb } from './types';

export type Zone = 'MAIN' | 'EXTRA' | 'SIDE';

export interface DeckEntry {
  card: SynCard;
  quantity: number;
  zone: Zone;
}

export interface Edge {
  from: number;
  to: number;
  verb: Verb | 'MENTION';
}

export interface ExtraCheck {
  cardId: number;
  mechanic: SummonMechanic;
  /** null = on ne sait pas lire ses matériaux */
  reachable: boolean | null;
  /** Cartes du main qui servent de matériaux */
  materialIds: number[];
}

export interface DeckAnalysis {
  features: Map<number, CardFeatures>;
  edges: Edge[];
  roles: Map<number, Role[]>;
  /** Nombre d'exemplaires par rôle (main deck) */
  roleCopies: Record<Role, number>;
  extra: ExtraCheck[];
  /** Cartes du main à effet "1 fois par tour" */
  oncePerTurn: number[];
  /** Starters qui consomment l'Invocation Normale (on ne peut en jouer qu'un par tour) */
  normalSummonStarters: number[];
  /** Monstres du main difficiles à jouer et que rien ne va chercher */
  bricks: number[];
  synergy: SynergyScore;
}

export interface SynergyScore {
  /** 0..1 — part des exemplaires du main reliés à au moins une autre carte du deck */
  connectedShare: number;
  /** 0..1 — densité de liens (recherches, invocations, envois) entre cartes du deck */
  density: number;
  /** Exemplaires de starters dans le main */
  starterCopies: number;
  /** 0..1 — part de l'Extra Deck réellement invocable avec le main */
  reachableExtra: number;
  /** 0..1 */
  score: number;
}

const ALL_ROLES: Role[] = [
  'STARTER',
  'SEARCHER',
  'EXTENDER',
  'HAND_TRAP',
  'INTERRUPTION',
  'REMOVAL',
  'DRAW',
  'RECOVERY',
  'FUSION_ENABLER',
  'RITUAL_ENABLER',
  'BOSS',
];

/** Cache des analyses de texte (le texte d'une carte ne change qu'à la sync du catalogue). */
const featureCache = new Map<number, { desc: string; f: CardFeatures }>();
export function featuresOf(card: SynCard): CardFeatures {
  const hit = featureCache.get(card.id);
  if (hit && hit.desc === card.desc) return hit.f;
  const f = parseCard(card);
  if (featureCache.size > 20_000) featureCache.clear();
  featureCache.set(card.id, { desc: card.desc, f });
  return f;
}

/**
 * Liens entre cartes : A → B si un effet de A peut chercher / invoquer / envoyer B
 * (en respectant l'endroit : une recherche "from your Deck" vise le main deck, etc.).
 */
export function buildEdges(entries: DeckEntry[]): Edge[] {
  const main = entries.filter((e) => e.zone === 'MAIN').map((e) => e.card);
  const extra = entries.filter((e) => e.zone === 'EXTRA').map((e) => e.card);
  const all = uniqueCards([...main, ...extra]);
  const edges: Edge[] = [];

  for (const a of all) {
    const fa = featuresOf(a);
    const linked = new Set<number>();
    for (const action of fa.actions) {
      const pool = action.verb === 'SUMMON_EXTRA' ? extra : main;
      for (const b of uniqueCards(pool)) {
        if (b.id === a.id && action.verb !== 'SPECIAL_SUMMON') continue;
        if (action.filters.some((f) => matches(b, f, featuresOf(b), action.from))) {
          edges.push({ from: a.id, to: b.id, verb: action.verb });
          linked.add(b.id);
        }
      }
    }
    // Citation directe d'un nom ("… reveal "Blue-Eyes White Dragon" …") : lien plus faible
    for (const b of all) {
      if (b.id !== a.id && !linked.has(b.id) && fa.mentions.includes(b.name)) {
        edges.push({ from: a.id, to: b.id, verb: 'MENTION' });
      }
    }
  }
  return edges;
}

export function analyzeDeck(entries: DeckEntry[]): DeckAnalysis {
  const features = new Map(entries.map((e) => [e.card.id, featuresOf(e.card)]));
  const edges = buildEdges(entries);
  const mainEntries = entries.filter((e) => e.zone === 'MAIN');
  const extraEntries = entries.filter((e) => e.zone === 'EXTRA');
  const extra = extraEntries.map((e) => checkExtra(e.card, mainEntries, features));
  const reachableIds = new Set(extra.filter((x) => x.reachable).map((x) => x.cardId));

  const out = (id: number, verbs: (Verb | 'MENTION')[]) =>
    edges.filter((e) => e.from === id && verbs.includes(e.verb) && e.to !== id);
  const deckTargets = (id: number, from: string) =>
    features
      .get(id)!
      .actions.filter((a) => a.from.includes(from as never))
      .some((a) => edges.some((e) => e.from === id && e.verb === a.verb));

  const roles = new Map<number, Role[]>();
  for (const { card, zone } of entries) {
    if (roles.has(card.id)) continue;
    const f = features.get(card.id)!;
    const r = new Set<Role>();
    const reachesDeck = deckTargets(card.id, 'DECK');
    // Jouable seul : magie/piège, s'invoque seul, se défausse pour activer, ou Invocation Normale
    // sans sacrifice (niveau 4 ou moins) avec un effet d'Invocation Normale ou d'ignition
    const normalSummonable = !f.cannotNormalSummon && (card.level ?? 0) <= 4;
    const playableAlone =
      card.category !== 'MONSTER' ||
      f.selfSummon ||
      f.discardIgnition ||
      (normalSummonable &&
        f.actions.some((a) => ['NS', 'NS_OR_SS', 'IGNITION'].includes(a.trigger)));
    if (zone === 'MAIN' && reachesDeck && playableAlone) r.add('STARTER');
    if (out(card.id, ['SEARCH']).length) r.add('SEARCHER');
    if (f.selfSummon || (f.sentToGyTrigger && out(card.id, ['SPECIAL_SUMMON', 'SEARCH']).length)) {
      r.add('EXTENDER');
    }
    // Invoque d'autres cartes depuis la main ou le cimetière (Dictator, Kaibaman…)
    const revives = f.actions.some(
      (a) => a.verb === 'SPECIAL_SUMMON' && (a.from.includes('HAND') || a.from.includes('GY')),
    );
    if (revives && out(card.id, ['SPECIAL_SUMMON']).length) r.add('EXTENDER');
    if (f.handTrap) r.add('HAND_TRAP');
    else if (f.negates) r.add('INTERRUPTION');
    if (f.removal) r.add('REMOVAL');
    if (f.draws) r.add('DRAW');
    if (out(card.id, ['RECOVER']).length) r.add('RECOVERY');
    if (f.fusionEnabler) r.add('FUSION_ENABLER');
    if (f.ritualEnabler) r.add('RITUAL_ENABLER');
    if (zone === 'EXTRA' && reachableIds.has(card.id)) r.add('BOSS');
    roles.set(card.id, [...r]);
  }

  const roleCopies = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const e of mainEntries)
    for (const r of roles.get(e.card.id) ?? []) roleCopies[r] += e.quantity;
  roleCopies.BOSS = extra.filter((x) => x.reachable).length;

  const accessed = new Set(edges.filter((e) => e.verb !== 'MENTION').map((e) => e.to));
  const bricks = uniqueCards(mainEntries.map((e) => e.card))
    .filter((c) => {
      const f = features.get(c.id)!;
      const hardToPlay =
        c.category === 'MONSTER' && f.cannotNormalSummon && !f.selfSummon && (c.level ?? 0) >= 5;
      return hardToPlay && !accessed.has(c.id);
    })
    .map((c) => c.id);

  return {
    features,
    edges,
    roles,
    roleCopies,
    extra,
    oncePerTurn: uniqueCards(mainEntries.map((e) => e.card))
      .filter((c) => features.get(c.id)!.oncePerTurn)
      .map((c) => c.id),
    normalSummonStarters: uniqueCards(mainEntries.map((e) => e.card))
      .filter(
        (c) => roles.get(c.id)!.includes('STARTER') && features.get(c.id)!.normalSummonTrigger,
      )
      .map((c) => c.id),
    bricks,
    synergy: synergyScore(mainEntries, edges, roleCopies.STARTER, extra),
  };
}

function synergyScore(
  main: DeckEntry[],
  edges: Edge[],
  starterCopies: number,
  extra: ExtraCheck[],
): SynergyScore {
  const mainIds = new Set(main.map((e) => e.card.id));
  const internal = edges.filter((e) => mainIds.has(e.from) && mainIds.has(e.to) && e.from !== e.to);
  const connected = new Set(internal.flatMap((e) => [e.from, e.to]));
  const total = Math.max(
    main.reduce((s, e) => s + e.quantity, 0),
    1,
  );
  const connectedShare =
    main.filter((e) => connected.has(e.card.id)).reduce((s, e) => s + e.quantity, 0) / total;
  const distinctPairs = new Set(internal.map((e) => `${e.from}>${e.to}`)).size;
  const density = Math.min(1, distinctPairs / Math.max(mainIds.size, 1));
  const reachableExtra = extra.length
    ? extra.reduce((s, x) => s + (x.reachable === null ? 0.5 : x.reachable ? 1 : 0), 0) /
      extra.length
    : 0;
  const score =
    0.35 * connectedShare +
    0.25 * density +
    0.25 * Math.min(starterCopies / 9, 1) +
    0.15 * reachableExtra;
  return { connectedShare, density, starterCopies, reachableExtra, score };
}

// ─── Invocations Extra Deck ──────────────────────────────────────────────────

const monsters = (entries: DeckEntry[]) =>
  entries.filter((e) => e.card.category === 'MONSTER' && e.zone === 'MAIN');

/** Le main deck permet-il d'invoquer ce monstre de l'Extra Deck ? */
export function checkExtra(
  card: SynCard,
  main: DeckEntry[],
  features: Map<number, CardFeatures> = new Map(),
): ExtraCheck {
  const f = features.get(card.id) ?? featuresOf(card);
  const m = f.materials;
  const mechanic = (m?.mechanic ?? card.frameType.split('_')[0]!.toUpperCase()) as SummonMechanic;
  if (!m || m.exotic) return { cardId: card.id, mechanic, reachable: null, materialIds: [] };

  const pool = monsters(main);
  const feat = (c: SynCard) => features.get(c.id) ?? featuresOf(c);
  const matching = (filter: Materials['parts'][number]['filter']) =>
    pool.filter((e) => matches(e.card, filter, feat(e.card)));

  switch (m.mechanic) {
    case 'XYZ': {
      const ok = (m.filter ? matching(m.filter) : pool).filter((e) => e.card.level === m.level);
      const copies = ok.reduce((s, e) => s + e.quantity, 0);
      return {
        cardId: card.id,
        mechanic,
        reachable: copies >= Math.max(2, m.count ?? 2),
        materialIds: ids(ok),
      };
    }
    case 'LINK': {
      const ok = m.filter ? matching(m.filter) : pool;
      const including = m.parts.every((p) => matching(p.filter).length > 0);
      const copies = ok.reduce((s, e) => s + e.quantity, 0);
      return {
        cardId: card.id,
        mechanic,
        reachable: including && copies >= Math.max(m.count ?? 2, 1),
        materialIds: ids(ok),
      };
    }
    case 'SYNCHRO': {
      if (!m.tuner || !m.nonTuner || !m.level)
        return { cardId: card.id, mechanic, reachable: null, materialIds: [] };
      const tuners = matching(m.tuner.filter);
      const nons = matching(m.nonTuner.filter).filter((e) => !/\bTuner\b/.test(e.card.type));
      const solution = synchroSolution(tuners, nons, m.tuner.count, m.level);
      return {
        cardId: card.id,
        mechanic,
        reachable: solution !== null,
        materialIds: solution ?? [],
      };
    }
    case 'FUSION': {
      const need = new Map<string, number>();
      const used: number[] = [];
      let ok = true;
      for (const part of m.parts) {
        const key = JSON.stringify(part.filter);
        need.set(key, (need.get(key) ?? 0) + part.count);
      }
      for (const [key, n] of need) {
        const cands = matching(JSON.parse(key));
        if (cands.reduce((s, e) => s + e.quantity, 0) < n) ok = false;
        used.push(...ids(cands));
      }
      const contact =
        /Special Summoned by (?:sending|Tributing|shuffling|banishing) the above/i.test(card.desc);
      const enabler = main.some((e) => feat(e.card).fusionEnabler);
      return {
        cardId: card.id,
        mechanic,
        reachable: ok && (contact || enabler),
        materialIds: used,
      };
    }
    default:
      return { cardId: card.id, mechanic, reachable: null, materialIds: [] };
  }
}

/** Cherche 1 (ou n) syntoniseur(s) + 1 à 3 non-syntoniseurs dont les niveaux font le total. */
function synchroSolution(
  tuners: DeckEntry[],
  nons: DeckEntry[],
  tunerCount: number,
  level: number,
): number[] | null {
  const withCopies = (xs: DeckEntry[]) =>
    xs.flatMap((e) => Array.from({ length: Math.min(e.quantity, 3) }, () => e.card));
  const T = withCopies(tuners);
  const N = withCopies(nons);
  const tunerSets = combos(T, tunerCount);
  for (const ts of tunerSets) {
    const tl = ts.reduce((s, c) => s + (c.level ?? 0), 0);
    for (let k = 1; k <= 3; k++) {
      for (const ns of combos(N, k)) {
        if (tl + ns.reduce((s, c) => s + (c.level ?? 0), 0) === level) {
          return [...new Set([...ts, ...ns].map((c) => c.id))];
        }
      }
    }
  }
  return null;
}

function combos<T>(xs: T[], k: number, start = 0): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  for (let i = start; i < xs.length && out.length < 400; i++) {
    for (const rest of combos(xs, k - 1, i + 1)) out.push([xs[i]!, ...rest]);
  }
  return out;
}

const ids = (xs: DeckEntry[]) => [...new Set(xs.map((e) => e.card.id))];
function uniqueCards(cards: SynCard[]): SynCard[] {
  return [...new Map(cards.map((c) => [c.id, c])).values()];
}
