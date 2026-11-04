import { DECK_RULES } from '@ygo/shared';
import { connectedCards, strengthInput } from '../decks/deck-strength';
import {
  copyLimit,
  INTERACTION_TARGET,
  PROVEN_SHARE,
  scoreDeck,
  type DeckScore,
  type EntrySource,
  type GenCardInfo,
  type GeneratedEntry,
  type GenerationResult,
  type ScoreOptions,
} from '../meta-decks/engine/generator';
import type { Zone } from '../meta-decks/engine/types';
import { affinity, linkScore } from '../synergy/engine/affinity';
import {
  analyzeDeck,
  buildEdges,
  checkExtra,
  featuresOf,
  linkQuality,
  type DeckAnalysis,
  type DeckEntry,
  type Edge,
} from '../synergy/engine/graph';
import type { Role, SynCard } from '../synergy/engine/types';

/**
 * Optimiseur de decks : à partir d'un premier jet (le générateur gourmand), chercher la liste
 * qui maximise la note de solidité, avec UNIQUEMENT des cartes possédées et légales.
 *
 * Pourquoi une recherche et pas une règle : la force d'un deck ne se lit pas carte par carte.
 * Une carte moyenne qui cherche trois de nos monstres vaut plus qu'une bonne carte isolée ;
 * le troisième exemplaire d'un starter vaut moins que le premier hand trap. Le générateur
 * remplit dans un ordre fixe (archétype, staples, compléments) et ne revient jamais sur un
 * choix ; l'optimiseur, lui, essaie des échanges et garde ceux que la note récompense.
 *
 * La note est `scoreDeck` — la même que partout ailleurs. L'optimiseur n'a AUCUNE idée de ce
 * qu'est un bon deck : il ne fait que proposer des échanges plausibles et demander à la note.
 * Les heuristiques ci-dessous (valeur d'une carte dans le deck, attrait d'une candidate) ne
 * servent qu'à choisir QUELS échanges essayer en premier, jamais à les accepter.
 *
 * Contraintes tenues à chaque échange, sans exception :
 *  - exemplaires possédés (toutes zones confondues) ;
 *  - limite légale (`copyLimit` : banlist TCG, zéro pour une carte hors TCG) ;
 *  - un main deck de 40 cartes (le minimum : chaque carte en plus éloigne des starters) ;
 *  - un Extra Deck de 15 au plus, fait de monstres réellement invocables avec ce main ;
 *  - un deck jouable ne redevient jamais injouable.
 *
 * Pur, sans I/O, déterministe : la même collection donne toujours le même deck, ce qui permet
 * à l'aperçu d'un deck proposé de retomber exactement sur la liste annoncée.
 */

export type OptCard = SynCard & GenCardInfo;

/** Une carte que l'optimiseur a le droit de jouer. */
export interface PoolCard {
  cardId: number;
  /** Origine si elle entre dans le deck : moteur (ARCHETYPE, SUPPORT…), STAPLE, FILLER */
  source: EntrySource;
  /** Exemplaires possédés */
  owned: number;
  /** 0..1 — préférence a priori (taux de jeu en tournoi…) : départage les candidates, ne décide rien */
  prior?: number;
  inclusion?: number | null;
}

export interface OptimizeInput {
  cards: ReadonlyMap<number, OptCard>;
  pool: readonly PoolCard[];
  /** Premier jet : le deck gourmand du générateur */
  seed: GenerationResult;
  /** Tout ce que la note prend en plus du deck (staples, taux de jeu, couverture meta) */
  scoring: Omit<ScoreOptions, 'synergy'>;
  /** Cartes qu'on ne retire jamais : le cœur d'une liste de tournoi */
  locked?: ReadonlySet<number>;
  /** Évaluations de la note au maximum (chacune ≈ 1 ms) */
  budget?: number;
}

export interface Evaluated {
  result: GenerationResult;
  score: DeckScore;
  analysis: DeckAnalysis;
}

export interface OptimizeResult extends Evaluated {
  /** Note du premier jet, pour dire ce que l'optimisation a gagné */
  baseline: DeckScore;
  /** Échanges retenus */
  swaps: number;
  evaluations: number;
}

/**
 * Échanges essayés par tour : les cartes les plus faibles du deck × les meilleures candidates,
 * prises séparément dans le moteur et hors moteur. Sans ce partage, les staples (bien notés
 * partout) occuperaient toutes les places, et un 3e exemplaire de starter ne serait jamais
 * essayé — c'est pourtant souvent le meilleur échange.
 */
const OUT_ENGINE = 4;
const OUT_OTHER = 3;
const IN_ENGINE = 5;
const IN_OTHER = 4;
const ENGINE: readonly EntrySource[] = ['CORE', 'FLEX', 'ARCHETYPE', 'SUPPORT'];
const DEFAULT_BUDGET = 300;
const MAIN_SIZE = DECK_RULES.MAIN.min;
const EXTRA_SIZE = DECK_RULES.EXTRA.max;
const SIDE_SIZE = DECK_RULES.SIDE.max;
/** En dessous, un gain de note n'est que du bruit d'arrondi. */
const EPSILON = 1e-4;

/** Ce qu'un rôle apporte à une carte déjà dans le deck (pour choisir quoi retirer en premier). */
const ROLE_VALUE: Partial<Record<Role, number>> = {
  STARTER: 3,
  EXTENDER: 2,
  SEARCHER: 1.5,
  HAND_TRAP: 2.5,
  INTERRUPTION: 1.5,
  DRAW: 1,
  RECOVERY: 0.5,
  FUSION_ENABLER: 1,
  RITUAL_ENABLER: 1,
};

/**
 * Note un deck exactement comme le reste de l'application : analyse de synergie, puis
 * `scoreDeck`. Une carte générique reliée au reste du deck est requalifiée en SUPPORT, comme
 * le fait `deck-strength.ts` pour un deck écrit à la main : la même liste a la même note,
 * qu'elle sorte du générateur ou du deck builder.
 */
export function evaluateDeck(
  result: GenerationResult,
  cards: ReadonlyMap<number, OptCard>,
  scoring: Omit<ScoreOptions, 'synergy'>,
  poolEdges?: readonly Edge[],
): Evaluated {
  const entries: DeckEntry[] = result.entries.flatMap((e) => {
    const card = cards.get(e.cardId);
    return card ? [{ card, quantity: e.quantity, zone: e.zone }] : [];
  });
  const analysis = analyzeDeck(entries, { poolEdges });
  const connected = connectedCards(analysis);
  const relabeled: GenerationResult = {
    ...result,
    entries: result.entries.map((e) =>
      e.source === 'FILLER' && e.zone === 'MAIN' && connected.has(e.cardId)
        ? { ...e, source: 'SUPPORT' }
        : e,
    ),
  };
  // Aucun lien lisible (textes absents ou tournures inconnues du lecteur) : on ne pénalise
  // pas le deck sur un critère qu'on ne sait pas évaluer, on garde la note classique
  const readable = analysis.edges.some((e) => e.verb !== 'MENTION');
  const score = scoreDeck(relabeled, {
    ...scoring,
    ...(readable && { synergy: strengthInput(analysis) }),
  });
  return { result: relabeled, score, analysis };
}

type Counts = Map<number, number>;

/** Ce qui manque au deck (0 = rien), pour choisir quoi essayer en premier. */
interface Needs {
  opening: number;
  interaction: number;
}

interface State {
  main: Counts;
  extra: Counts;
  side: Counts;
}

export function optimizeDeck(input: OptimizeInput): OptimizeResult {
  const { cards, scoring } = input;
  const locked = input.locked ?? new Set<number>();
  const budget = input.budget ?? DEFAULT_BUDGET;

  // ─── Réserve : ce qu'on a le droit de jouer, et combien ───────────────────
  const meta = new Map<number, { source: EntrySource; inclusion: number | null; prior: number }>();
  const available = new Map<number, number>();
  const allow = (id: number, owned: number) => {
    const info = cards.get(id);
    if (!info || info.category === 'SKILL' || info.category === 'TOKEN') return;
    const cap = Math.min(owned, copyLimit(info));
    available.set(id, Math.max(available.get(id) ?? 0, cap));
  };
  for (const e of input.seed.entries) {
    meta.set(e.cardId, { source: e.source, inclusion: e.inclusion, prior: 0 });
  }
  for (const p of input.pool) {
    allow(p.cardId, p.owned);
    const prev = meta.get(p.cardId);
    meta.set(p.cardId, {
      source: prev?.source ?? p.source,
      inclusion: prev?.inclusion ?? p.inclusion ?? null,
      prior: p.prior ?? 0,
    });
  }
  // Le premier jet ne contient que des cartes possédées : ses exemplaires sont acquis
  const seedOwned = new Map<number, number>();
  for (const e of input.seed.entries)
    seedOwned.set(e.cardId, (seedOwned.get(e.cardId) ?? 0) + e.owned);
  for (const [id, owned] of seedOwned) if (!available.has(id)) allow(id, owned);

  const poolIds = [...available.keys()].sort((a, b) => a - b);
  const poolCards = poolIds.flatMap((id) => (cards.has(id) ? [cards.get(id)!] : []));
  // Liens de toute la réserve, calculés une fois : chaque évaluation n'a plus qu'à filtrer.
  // Sans recherche (simple premier jet), ce calcul coûterait plus que les deux évaluations.
  const poolEdges =
    budget > 0
      ? buildEdges(
          poolCards.map((card) => ({
            card,
            quantity: 1,
            zone: card.isExtraDeck ? ('EXTRA' as const) : ('MAIN' as const),
          })),
        )
      : undefined;
  const isStaple = (id: number) =>
    !!scoring.stapleIds?.has(id) || meta.get(id)?.source === 'STAPLE';

  // ─── État ─────────────────────────────────────────────────────────────────
  const state: State = { main: new Map(), extra: new Map(), side: new Map() };
  const used = (s: State, id: number) =>
    (s.main.get(id) ?? 0) + (s.extra.get(id) ?? 0) + (s.side.get(id) ?? 0);
  const spare = (s: State, id: number) => (available.get(id) ?? 0) - used(s, id);
  const size = (c: Counts) => [...c.values()].reduce((a, b) => a + b, 0);
  const bump = (c: Counts, id: number, by: number) => {
    const q = (c.get(id) ?? 0) + by;
    if (q > 0) c.set(id, q);
    else c.delete(id);
  };

  // Le premier jet, recadré sur les limites (il les respecte déjà : c'est une ceinture)
  for (const e of input.seed.entries) {
    const zone = e.zone === 'SIDE' ? state.side : e.zone === 'EXTRA' ? state.extra : state.main;
    const room = e.zone === 'MAIN' ? MAIN_SIZE - size(state.main) : Number.POSITIVE_INFINITY;
    const q = Math.min(e.quantity, spare(state, e.cardId), room);
    if (q > 0) bump(zone, e.cardId, q);
  }

  const toResult = (s: State): GenerationResult => {
    const entries: GeneratedEntry[] = [];
    const push = (zone: Zone, c: Counts) => {
      for (const [cardId, quantity] of [...c].sort((a, b) => a[0] - b[0])) {
        const m = meta.get(cardId);
        entries.push({
          cardId,
          zone,
          quantity,
          owned: quantity,
          source: m?.source ?? 'FILLER',
          inclusion: m?.inclusion ?? null,
        });
      }
    };
    push('MAIN', s.main);
    push('EXTRA', s.extra);
    push('SIDE', s.side);
    const counts = { MAIN: size(s.main), EXTRA: size(s.extra), SIDE: size(s.side) };
    return { entries, counts, missingCopies: 0, complete: counts.MAIN >= MAIN_SIZE };
  };

  let evaluations = 0;
  const evaluate = (s: State): Evaluated => {
    evaluations++;
    return evaluateDeck(toResult(s), cards, scoring, poolEdges);
  };
  const clone = (s: State): State => ({
    main: new Map(s.main),
    extra: new Map(s.extra),
    side: new Map(s.side),
  });

  // ─── Valeurs indicatives (ordre des essais, jamais l'acceptation) ─────────
  const mainCards = (s: State) =>
    [...s.main.keys()].flatMap((id) => (cards.has(id) ? [cards.get(id)!] : []));

  /** Ce que perd le deck en retirant un exemplaire de cette carte : bas = à essayer d'abord. */
  const keepValue = (id: number, s: State, a: DeckAnalysis, degree: Map<number, number>) => {
    const f = a.features.get(id) ?? featuresOf(cards.get(id)!);
    let v = 0;
    for (const role of a.roles.get(id) ?? []) v += ROLE_VALUE[role] ?? 0;
    v += Math.min(degree.get(id) ?? 0, 6) * 0.5;
    if (isStaple(id)) v += 2;
    if (f.boardBreaker) v += 1.5;
    if (f.negates || f.floodgate) v += 0.75;
    if (a.bricks.includes(id)) v -= 4;
    v += 2 * (meta.get(id)?.prior ?? 0);
    // Le 3e exemplaire compte moins que le 1er
    return v - 0.35 * ((s.main.get(id) ?? 1) - 1);
  };

  /**
   * Attrait d'une candidate pour CE deck : ses liens avec lui, son rôle, son pedigree — et ce
   * qui manque au deck. Un deck qui ouvre mal essaie d'abord des starters, un deck qui ne gêne
   * pas l'adversaire essaie d'abord des hand traps.
   */
  const addValue = (id: number, core: SynCard[], a: DeckAnalysis, needs: Needs) => {
    const card = cards.get(id)!;
    const f = featuresOf(card);
    let v = affinity(core, card);
    if (isStaple(id)) v += 2;
    if (f.boardBreaker) v += 1.5;
    if (f.negates) v += 0.75;
    if (needs.opening && startsAlone(card, core, a)) v += 6 * needs.opening;
    if (needs.interaction && (f.handTrap || f.boardBreaker || f.negates || isStaple(id))) {
      v += 4 * needs.interaction;
    }
    return v + 2 * (meta.get(id)?.prior ?? 0);
  };

  /** La carte lancerait-elle le jeu seule dans ce deck ? (même lecture que le rôle STARTER) */
  const startsAlone = (card: OptCard, core: SynCard[], a: DeckAnalysis) => {
    if (a.roles.get(card.id)?.includes('STARTER')) return true;
    const f = featuresOf(card);
    const alone =
      card.category !== 'MONSTER' ||
      f.selfSummon ||
      f.discardIgnition ||
      (!f.cannotNormalSummon &&
        (card.level ?? 0) <= 4 &&
        f.actions.some((x) => ['NS', 'NS_OR_SS', 'IGNITION'].includes(x.trigger)));
    return (
      alone &&
      f.actions.some(
        (x) =>
          x.from.includes('DECK') &&
          x.verb !== 'SUMMON_EXTRA' &&
          core.some((c) => c.id !== card.id && linkQuality(x, c, featuresOf(c)) === 2),
      )
    );
  };

  const mainCandidates = (s: State) =>
    poolIds.filter((id) => {
      const c = cards.get(id);
      return c && !c.isExtraDeck && spare(s, id) > 0;
    });

  // ─── Extra Deck : des monstres qu'on peut vraiment invoquer avec ce main ──
  const chooseExtra = (s: State) => {
    const mainEntries: DeckEntry[] = [...s.main].map(([id, quantity]) => ({
      card: cards.get(id)!,
      quantity,
      zone: 'MAIN',
    }));
    const core = mainCards(s);
    const archetypes = new Set(core.map((c) => c.archetype).filter(Boolean));
    const previous = s.extra;
    s.extra = new Map();
    const candidates = poolIds
      .filter((id) => cards.get(id)?.isExtraDeck && (available.get(id) ?? 0) > 0)
      .map((id) => {
        const card = cards.get(id)!;
        const reach = checkExtra(card, mainEntries).reachable;
        const tied = locked.has(id) || ['CORE', 'FLEX'].includes(meta.get(id)?.source ?? '');
        const value =
          (tied ? 100 : 0) +
          (reach === true ? 10 : 0) +
          (card.archetype && archetypes.has(card.archetype) ? 3 : 0) +
          Math.min(linkScore(core, card), 4) +
          2 * (meta.get(id)?.prior ?? 0) +
          (card.linkVal ? card.linkVal * 2 : (card.level ?? 0)) / 12;
        // Inconnu (rank-up, matériaux illisibles) : seulement s'il vient de la liste de référence
        const keep = reach === true || (reach === null && tied) || locked.has(id);
        return { id, value, keep, want: Math.max(1, previous.get(id) ?? 1) };
      })
      .filter((c) => c.keep)
      .sort((a, b) => b.value - a.value || a.id - b.id);
    for (const c of candidates) {
      const room = EXTRA_SIZE - size(s.extra);
      if (room <= 0) break;
      const q = Math.min(c.want, spare(s, c.id), room);
      if (q > 0) bump(s.extra, c.id, q);
    }
  };

  // ─── Compléter un premier jet incomplet ───────────────────────────────────
  const fill = (s: State) => {
    while (size(s.main) < MAIN_SIZE) {
      const core = mainCards(s);
      const a = analyzeDeck(
        [...s.main].map(([id, quantity]) => ({ card: cards.get(id)!, quantity, zone: 'MAIN' })),
        { poolEdges },
      );
      const next = mainCandidates(s)
        .map((id) => ({ id, v: addValue(id, core, a, { opening: 0.5, interaction: 0.5 }) }))
        .sort((a, b) => b.v - a.v || a.id - b.id)[0];
      if (!next) return;
      bump(s.main, next.id, Math.min(spare(s, next.id), MAIN_SIZE - size(s.main), 3));
    }
  };

  fill(state);
  chooseExtra(state);
  const baseline = evaluate(state);
  let current = baseline;
  let best = { state: clone(state), ev: baseline };
  let swaps = 0;

  // ─── Recherche locale : premier échange qui améliore, jusqu'à épuisement ──
  const better = (candidate: Evaluated, than: Evaluated) =>
    candidate.score.raw > than.score.raw + EPSILON &&
    // Un deck jouable ne redevient jamais injouable, même pour une meilleure note
    (candidate.score.playable || !than.score.playable);

  while (evaluations < budget && state.main.size) {
    const a = current.analysis;
    const degree = new Map<number, number>();
    for (const e of a.edges) {
      if (e.verb === 'MENTION' || e.weak || e.from === e.to) continue;
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    }
    const core = mainCards(state);
    const isEngine = (id: number) => ENGINE.includes(meta.get(id)?.source ?? 'FILLER');
    const split = <T extends { id: number }>(xs: T[], engine: number, other: number) => {
      const a = xs.filter((x) => isEngine(x.id)).slice(0, engine);
      const b = xs.filter((x) => !isEngine(x.id)).slice(0, other);
      // Entrelacés : le meilleur de chaque côté est essayé tôt
      return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]])
        .flat()
        .filter((x): x is T => !!x);
    };
    const needs: Needs = {
      opening: Math.max(0, 0.9 - (current.score.opening ?? 0.9)),
      interaction:
        current.score.interaction === null
          ? 0
          : Math.max(0, INTERACTION_TARGET - current.score.interaction) / INTERACTION_TARGET,
    };
    const outs = split(
      [...state.main.keys()]
        .filter((id) => !locked.has(id))
        .map((id) => ({ id, v: keepValue(id, state, a, degree) }))
        .sort((x, y) => x.v - y.v || x.id - y.id),
      OUT_ENGINE,
      OUT_OTHER,
    );
    const ins = split(
      mainCandidates(state)
        .map((id) => ({ id, v: addValue(id, core, a, needs) }))
        .sort((x, y) => y.v - x.v || x.id - y.id),
      IN_ENGINE,
      IN_OTHER,
    );

    // Les paires les plus prometteuses d'abord : carte faible contre candidate forte
    const pairs = outs
      .flatMap((o, i) => ins.map((n, j) => ({ out: o.id, in: n.id, rank: i + j })))
      .filter((p) => p.out !== p.in)
      .sort((x, y) => x.rank - y.rank || x.out - y.out || x.in - y.in);

    let moved = false;
    for (const p of pairs) {
      const max = Math.min(state.main.get(p.out) ?? 0, spare(state, p.in));
      for (const k of max > 1 ? [1, max] : [1]) {
        if (evaluations >= budget) break;
        const next = clone(state);
        bump(next.main, p.out, -k);
        bump(next.main, p.in, k);
        const ev = evaluate(next);
        if (better(ev, current)) {
          state.main = next.main;
          current = ev;
          swaps++;
          moved = true;
          break;
        }
      }
      if (moved || evaluations >= budget) break;
    }
    if (!moved) break;
  }

  // Le main a bougé : on refait l'Extra Deck pour lui, et on garde la meilleure des deux versions
  best = better(current, best.ev) ? { state: clone(state), ev: current } : best;
  const reworked = clone(best.state);
  chooseExtra(reworked);
  const withExtra = evaluate(reworked);
  if (withExtra.score.raw >= best.ev.score.raw - EPSILON) best = { state: reworked, ev: withExtra };

  // Side Deck : les cartes d'interaction qui restent, pour les matchs 2 et 3. La note ne lit
  // que le main ; le side ne change rien au classement, il rend juste le deck complet.
  const final = best.state;
  const sideCandidates = poolIds
    .filter((id) => {
      const c = cards.get(id);
      if (!c || c.isExtraDeck) return false;
      const f = featuresOf(c);
      return f.handTrap || f.boardBreaker || f.floodgate || f.negates || isStaple(id);
    })
    .map((id) => {
      const f = featuresOf(cards.get(id)!);
      const v =
        (isStaple(id) ? 2 : 0) +
        (f.handTrap ? 2 : 0) +
        (f.boardBreaker ? 2 : 0) +
        (f.floodgate ? 1.5 : 0) +
        (f.negates ? 1 : 0) +
        2 * (meta.get(id)?.prior ?? 0);
      return { id, v };
    })
    .sort((x, y) => y.v - x.v || x.id - y.id);
  for (const c of sideCandidates) {
    const room = SIDE_SIZE - size(final.side);
    if (room <= 0) break;
    const q = Math.min(spare(final, c.id), 3 - (final.side.get(c.id) ?? 0), room);
    if (q > 0) {
      bump(final.side, c.id, q);
      if (!meta.has(c.id)) meta.set(c.id, { source: 'STAPLE', inclusion: null, prior: 0 });
    }
  }
  const done = final.side.size ? evaluate(final) : best.ev;

  return {
    ...done,
    baseline: baseline.score,
    swaps,
    evaluations,
  };
}

// ─── Réserve ─────────────────────────────────────────────────────────────────

/** Cartes d'un autre archétype (ou génériques) reliées au cœur, gardées comme second moteur. */
export const MAX_LINKED = 40;
/** Liens minimum avec le cœur pour qu'une carte soit un vrai second moteur, pas un hasard. */
export const MIN_LINKS = 2;
/** Compléments génériques proposés à l'optimiseur (les plus joués d'abord). */
export const MAX_FILLERS = 120;
/** Monstres d'Extra Deck proposés à l'optimiseur. */
export const MAX_EXTRA_CANDIDATES = 40;

export interface PoolInput {
  seed: GenerationResult;
  /** Origine des cartes de la liste de référence, de l'archétype et de ses supports */
  sources: ReadonlyMap<number, { source: EntrySource; inclusion: number | null }>;
  archetype: string | null;
  owned: ReadonlyMap<number, number>;
  /** Doit contenir toutes les cartes citées ci-dessus, et la collection si elle est fournie */
  cards: ReadonlyMap<number, OptCard>;
  staples: readonly { cardId: number }[];
  /** Compléments génériques possédés, des meilleurs aux moins bons */
  fillers: readonly number[];
  metaPlay: ReadonlyMap<number, number>;
  /**
   * Popularité des cartes (vues sur YGOPRODeck). Moins parlante qu'un taux de jeu en tournoi —
   * la nostalgie fait aussi des vues — elle départage quand même les cartes que personne n'a
   * encore jouées en tournoi.
   */
  popularity?: ReadonlyMap<number, number>;
  /**
   * Toute la collection. Fournie, on y cherche un second moteur et des monstres d'Extra Deck ;
   * absente, la réserve se limite au premier jet (c'est ce qu'on veut pour un simple aperçu).
   */
  collection?: readonly OptCard[];
}

/**
 * Tout ce que la collection offre à CE deck : son moteur, ses supports, les staples et les
 * compléments possédés, et — ce qui fait les decks hybrides — les cartes d'autres archétypes
 * qui ont de vrais liens avec son cœur (elles cherchent nos monstres, nos effets les
 * invoquent…). Plus les monstres d'Extra Deck que ce cœur sait invoquer.
 */
export function buildPool(input: PoolInput): PoolCard[] {
  const { seed, sources, owned, cards, metaPlay } = input;
  // Rang de popularité ramené à 0..0.4 : un départage, jamais l'équivalent d'un taux de jeu
  const ranked = [...(input.popularity ?? new Map<number, number>())].sort(
    (a, b) => a[1] - b[1] || a[0] - b[0],
  );
  const popular = new Map(ranked.map(([id], i) => [id, (0.4 * (i + 1)) / ranked.length]));
  const prior = (id: number) =>
    Math.max(Math.min(1, (metaPlay.get(id) ?? 0) / PROVEN_SHARE), popular.get(id) ?? 0);
  const pool = new Map<number, PoolCard>();
  const add = (id: number, source: EntrySource, inclusion: number | null = null, bonus = 0) => {
    const n = owned.get(id) ?? 0;
    if (!n || pool.has(id)) return;
    pool.set(id, { cardId: id, source, owned: n, inclusion, prior: Math.max(prior(id), bonus) });
  };
  for (const e of seed.entries)
    add(e.cardId, sources.get(e.cardId)?.source ?? e.source, e.inclusion);
  for (const [id, s] of sources) add(id, s.source, s.inclusion);
  for (const s of input.staples) add(s.cardId, 'STAPLE');
  const fillers = input.fillers.slice(0, MAX_FILLERS);
  // Les compléments arrivent triés (taux de jeu, puis popularité) : leur rang départage
  fillers.forEach((id, i) => add(id, 'FILLER', null, 0.3 * (1 - i / fillers.length)));

  const collection = input.collection;
  if (!collection) return [...pool.values()];

  const engine = ['CORE', 'FLEX', 'ARCHETYPE', 'SUPPORT'];
  const core = seed.entries
    .filter((e) => e.zone === 'MAIN' && engine.includes(e.source))
    .flatMap((e) => (cards.has(e.cardId) ? [cards.get(e.cardId)!] : []));
  const primary = input.archetype?.toLowerCase() ?? null;

  // Second moteur : les cartes possédées reliées au cœur par de vrais liens
  if (core.length) {
    const linked = collection
      .filter(
        (c) =>
          !pool.has(c.id) &&
          !c.isExtraDeck &&
          copyLimit(c) > 0 &&
          (c.category === 'MONSTER' || c.category === 'SPELL' || c.category === 'TRAP') &&
          c.archetype?.toLowerCase() !== primary,
      )
      .map((c) => ({ id: c.id, links: linkScore(core, c) }))
      .filter((c) => c.links >= MIN_LINKS)
      .sort((a, b) => b.links + prior(b.id) - (a.links + prior(a.id)) || a.id - b.id)
      .slice(0, MAX_LINKED);
    for (const c of linked) add(c.id, 'SUPPORT');
  }

  // Extra Deck : ce que le premier jet sait déjà invoquer, les monstres de nos archétypes d'abord
  const mainEntries: DeckEntry[] = seed.entries.flatMap((e) =>
    e.zone === 'MAIN' && cards.has(e.cardId)
      ? [{ card: cards.get(e.cardId)!, quantity: e.quantity, zone: 'MAIN' as const }]
      : [],
  );
  const archetypes = new Set(
    [...pool.values()].flatMap((p) => {
      const a = cards.get(p.cardId)?.archetype;
      return a && p.source !== 'FILLER' && p.source !== 'STAPLE' ? [a] : [];
    }),
  );
  const extras = collection
    .filter((c) => c.isExtraDeck && !pool.has(c.id) && copyLimit(c) > 0)
    .flatMap((c) => {
      const ours = !!c.archetype && archetypes.has(c.archetype);
      const reachable = checkExtra(c, mainEntries).reachable === true;
      return ours || reachable
        ? [{ id: c.id, ours, value: (ours ? 5 : 0) + (reachable ? 3 : 0) + 2 * prior(c.id) }]
        : [];
    })
    .sort((a, b) => b.value - a.value || a.id - b.id)
    .slice(0, MAX_EXTRA_CANDIDATES);
  for (const c of extras) add(c.id, c.ours ? 'ARCHETYPE' : 'FILLER');
  return [...pool.values()];
}

/** Ce que la légalité a coûté à une réserve : cartes écartées (interdites, hors TCG) et bridées. */
export function legalityOf(
  pool: readonly PoolCard[],
  cards: ReadonlyMap<number, Pick<GenCardInfo, 'banTcg' | 'tcgLegal'>>,
): { excluded: number; capped: number } {
  let excluded = 0;
  let capped = 0;
  for (const p of pool) {
    const limit = copyLimit(cards.get(p.cardId) ?? { banTcg: null });
    if (limit === 0) excluded++;
    else if (p.owned > limit) capped++;
  }
  return { excluded, capped };
}

/** Archétypes qui portent le deck : ceux qui tiennent au moins `min` exemplaires du main. */
export function enginesOf(
  result: GenerationResult,
  cards: ReadonlyMap<number, Pick<SynCard, 'archetype'>>,
  min = 6,
): string[] {
  const copies = new Map<string, number>();
  for (const e of result.entries) {
    if (e.zone !== 'MAIN' || e.source === 'STAPLE') continue;
    const a = cards.get(e.cardId)?.archetype;
    if (a) copies.set(a, (copies.get(a) ?? 0) + e.quantity);
  }
  return [...copies]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([a]) => a);
}

/** Part des exemplaires du main que deux decks ont en commun (0..1). */
export function overlap(a: GenerationResult, b: GenerationResult): number {
  const count = (r: GenerationResult) => {
    const m = new Map<number, number>();
    for (const e of r.entries)
      if (e.zone === 'MAIN') m.set(e.cardId, (m.get(e.cardId) ?? 0) + e.quantity);
    return m;
  };
  const ma = count(a);
  const mb = count(b);
  let shared = 0;
  for (const [id, q] of ma) shared += Math.min(q, mb.get(id) ?? 0);
  const total = Math.max(a.counts.MAIN, b.counts.MAIN, 1);
  return shared / total;
}
