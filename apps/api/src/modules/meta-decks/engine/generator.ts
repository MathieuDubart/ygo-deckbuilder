import { DECK_RULES, maxCopiesFor } from '@ygo/shared';
import type { DeckTemplate, TemplateCard, Zone } from './types';

export type CardKind = 'MONSTER' | 'SPELL' | 'TRAP' | 'SKILL' | 'TOKEN';

export interface GenCardInfo {
  id: number;
  isExtraDeck: boolean;
  banTcg: string | null;
  category: CardKind;
}

/**
 * Origine d'une carte dans un deck généré :
 *  CORE      liste type de l'archétype (tournois)
 *  FLEX      jouée par une partie des listes de l'archétype
 *  ARCHETYPE carte de l'archétype
 *  SUPPORT   carte qui cite l'archétype
 *  STAPLE    carte générique du meta (hand traps, board breakers…)
 *  FILLER    complément générique pour atteindre un deck jouable
 */
export type EntrySource = 'CORE' | 'FLEX' | 'STAPLE' | 'ARCHETYPE' | 'SUPPORT' | 'FILLER';

/** Sources qui forment le "moteur" du deck (par opposition aux cartes génériques). */
const ENGINE_SOURCES: EntrySource[] = ['CORE', 'FLEX', 'ARCHETYPE', 'SUPPORT'];

export interface GeneratedEntry {
  cardId: number;
  zone: Zone;
  quantity: number;
  /** Exemplaires de cette ligne réellement possédés */
  owned: number;
  source: EntrySource;
  /** Taux de jeu dans l'archétype (listes de tournoi), si connu */
  inclusion: number | null;
}

export interface GenerationResult {
  entries: GeneratedEntry[];
  counts: Record<Zone, number>;
  missingCopies: number;
  /** Main deck d'au moins 40 cartes */
  complete: boolean;
}

export interface Candidate {
  cardId: number;
  /** Exemplaires souhaités */
  want: number;
  source: EntrySource;
  inclusion?: number | null;
  zone?: Zone;
}

export interface AssembleOptions {
  cards: Map<number, GenCardInfo>;
  owned: Map<number, number>;
  onlyOwned: boolean;
  mainTarget: number;
}

/**
 * Construit un deck carte par carte en respectant : zone (Extra ⇄ Main), limite de 3 /
 * banlist, taille des zones, et — en mode "mes cartes" — les exemplaires réellement
 * possédés (consommés une seule fois même si la carte est dans plusieurs zones).
 */
export class DeckAssembler {
  private readonly entries = new Map<string, GeneratedEntry>();
  private readonly inDeck = new Map<number, number>();
  private readonly remaining: Map<number, number>;
  readonly counts: Record<Zone, number> = { MAIN: 0, EXTRA: 0, SIDE: 0 };
  readonly mainByKind: Record<CardKind, number> = {
    MONSTER: 0,
    SPELL: 0,
    TRAP: 0,
    SKILL: 0,
    TOKEN: 0,
  };
  private readonly cap: Record<Zone, number>;

  constructor(private readonly opts: AssembleOptions) {
    this.remaining = new Map(opts.owned);
    this.cap = { MAIN: opts.mainTarget, EXTRA: DECK_RULES.EXTRA.max, SIDE: DECK_RULES.SIDE.max };
  }

  zoneOf(c: Candidate): Zone | null {
    const info = this.opts.cards.get(c.cardId);
    if (!info || info.category === 'SKILL' || info.category === 'TOKEN') return null;
    return c.zone === 'SIDE' ? 'SIDE' : info.isExtraDeck ? 'EXTRA' : 'MAIN';
  }

  roomIn(zone: Zone): number {
    return this.cap[zone] - this.counts[zone];
  }

  /** Ajoute jusqu'à `want` exemplaires ; renvoie le nombre réellement ajouté. */
  add(c: Candidate): number {
    const info = this.opts.cards.get(c.cardId);
    const zone = this.zoneOf(c);
    if (!info || !zone) return 0;
    const limit = maxCopiesFor(info.banTcg) - (this.inDeck.get(c.cardId) ?? 0);
    const available = this.remaining.get(c.cardId) ?? 0;
    let q = Math.min(c.want, limit, this.roomIn(zone));
    if (this.opts.onlyOwned) q = Math.min(q, available);
    if (q <= 0) return 0;

    const owned = Math.min(q, available);
    this.remaining.set(c.cardId, available - owned);
    this.inDeck.set(c.cardId, (this.inDeck.get(c.cardId) ?? 0) + q);
    this.counts[zone] += q;
    if (zone === 'MAIN') this.mainByKind[info.category] += q;

    const key = `${zone}:${c.cardId}`;
    const prev = this.entries.get(key);
    this.entries.set(key, {
      cardId: c.cardId,
      zone,
      quantity: (prev?.quantity ?? 0) + q,
      owned: (prev?.owned ?? 0) + owned,
      source: prev?.source ?? c.source,
      inclusion: prev?.inclusion ?? c.inclusion ?? null,
    });
    return q;
  }

  result(): GenerationResult {
    const list = [...this.entries.values()];
    return {
      entries: list,
      counts: { ...this.counts },
      missingCopies: list.reduce((s, e) => s + e.quantity - e.owned, 0),
      complete: this.counts.MAIN >= DECK_RULES.MAIN.min,
    };
  }
}

export function fillDeck(candidates: Candidate[], opts: AssembleOptions): GenerationResult {
  const deck = new DeckAssembler(opts);
  for (const c of candidates) deck.add(c);
  return deck.result();
}

/** Répartition visée pour le main deck quand on complète avec des cartes génériques. */
const TARGET_RATIO: Partial<Record<CardKind, number>> = { MONSTER: 0.5, SPELL: 0.33, TRAP: 0.17 };

/**
 * Complète le main deck jusqu'à la taille visée avec des cartes génériques possédées,
 * en piochant à chaque fois dans la catégorie (monstre / magie / piège) la plus en
 * retard sur la répartition visée. Les fillers sont déjà triés du meilleur au moins bon.
 */
export function topUp(deck: DeckAssembler, fillers: Candidate[], cards: Map<number, GenCardInfo>) {
  const queues = new Map<CardKind, Candidate[]>();
  for (const f of fillers) {
    const kind = cards.get(f.cardId)?.category;
    if (!kind || !(kind in TARGET_RATIO) || deck.zoneOf(f) !== 'MAIN') continue;
    queues.set(kind, [...(queues.get(kind) ?? []), f]);
  }
  while (deck.roomIn('MAIN') > 0) {
    const total = deck.counts.MAIN + 1;
    const next = (Object.keys(TARGET_RATIO) as CardKind[])
      .filter((k) => queues.get(k)?.length)
      .sort(
        (a, b) =>
          deck.mainByKind[a] / total -
          TARGET_RATIO[a]! -
          (deck.mainByKind[b] / total - TARGET_RATIO[b]!),
      )[0];
    if (!next) break;
    const candidate = queues.get(next)!.shift()!;
    deck.add({ ...candidate, want: Math.min(candidate.want, deck.roomIn('MAIN')) });
  }

  // Extra deck : monstres génériques possédés (Link/Xyz/Synchro "toutes utilisations")
  for (const f of fillers) {
    if (deck.roomIn('EXTRA') <= 0) break;
    if (deck.zoneOf(f) === 'EXTRA') deck.add({ ...f, want: 1 });
  }
}

const byInclusion = (a: TemplateCard, b: TemplateCard) => b.inclusion - a.inclusion;
const fromTemplate = (t: TemplateCard, source: EntrySource): Candidate => ({
  cardId: t.cardId,
  want: t.quantity,
  source,
  inclusion: t.inclusion,
  zone: t.zone,
});

export interface Staple {
  cardId: number;
  avgCopies: number;
}

export interface OwnedPools {
  staples: Staple[];
  archetypeCards: number[];
  /** Cartes génériques possédées (sans archétype), des meilleures aux moins bonnes */
  fillers?: number[];
}

const staplesAsCandidates = (staples: Staple[]): Candidate[] =>
  staples.map((s) => ({
    cardId: s.cardId,
    want: Math.max(1, Math.round(s.avgCopies)),
    source: 'STAPLE',
  }));

const fillersAsCandidates = (ids: number[] = []): Candidate[] =>
  ids.map((id) => ({ cardId: id, want: 2, source: 'FILLER' }));

/**
 * Deck basé sur un archétype du meta.
 *  - META : la liste type telle quelle (on indique juste ce qui manque)
 *  - OWNED : uniquement tes cartes — cœur de la liste, cartes flex, cartes de l'archétype,
 *            staples possédés, puis complément générique équilibré jusqu'à 40.
 */
export function generateFromTemplate(
  template: DeckTemplate,
  opts: OwnedPools & {
    mode: 'META' | 'OWNED';
    cards: Map<number, GenCardInfo>;
    owned: Map<number, number>;
  },
): GenerationResult {
  const core = template.cards.filter((c) => c.zone !== 'SIDE').sort(byInclusion);
  const side = template.cards.filter((c) => c.zone === 'SIDE').sort(byInclusion);
  const deck = new DeckAssembler({
    cards: opts.cards,
    owned: opts.owned,
    onlyOwned: opts.mode === 'OWNED',
    mainTarget: opts.mode === 'OWNED' ? DECK_RULES.MAIN.min : template.mainSize,
  });

  if (opts.mode === 'META') {
    for (const c of [...core, ...side]) deck.add(fromTemplate(c, 'CORE'));
    return deck.result();
  }

  const priority: Candidate[] = [
    ...core.map((c) => fromTemplate(c, 'CORE')),
    ...template.flex
      .filter((c) => c.zone !== 'SIDE')
      .sort(byInclusion)
      .map((c) => fromTemplate(c, 'FLEX')),
    // Moteur avant génériques : un deck dense dans son archétype est plus régulier
    ...opts.archetypeCards.map((id) => ({ cardId: id, want: 3, source: 'ARCHETYPE' as const })),
    ...staplesAsCandidates(opts.staples),
  ];
  for (const c of priority) deck.add(c);
  topUp(deck, fillersAsCandidates(opts.fillers), opts.cards);
  for (const c of side) deck.add(fromTemplate(c, 'CORE'));
  return deck.result();
}

/**
 * Deck "maison" à partir d'un archétype de ta collection : cartes de l'archétype,
 * cartes qui le supportent, staples possédés, puis complément générique équilibré.
 */
export function generateFromArchetype(
  opts: OwnedPools & {
    cards: Map<number, GenCardInfo>;
    owned: Map<number, number>;
    supportCards: number[];
  },
): GenerationResult {
  const deck = new DeckAssembler({
    cards: opts.cards,
    owned: opts.owned,
    onlyOwned: true,
    mainTarget: DECK_RULES.MAIN.min,
  });
  for (const c of [
    ...opts.archetypeCards.map((id) => ({ cardId: id, want: 3, source: 'ARCHETYPE' as const })),
    ...opts.supportCards.map((id) => ({ cardId: id, want: 2, source: 'SUPPORT' as const })),
    ...staplesAsCandidates(opts.staples),
  ]) {
    deck.add(c);
  }
  topUp(deck, fillersAsCandidates(opts.fillers), opts.cards);
  return deck.result();
}

// ─── Évaluation ──────────────────────────────────────────────────────────────

export interface DeckScore {
  /** 0..100 */
  score: number;
  /** Part du main deck tenue par le moteur (archétype, liste type, support) */
  engineShare: number;
  /** Nombre de staples du meta dans le main */
  staples: number;
  /** Part des cartes moteur jouées en 3 exemplaires (pioche régulière) */
  consistency: number;
  /** Part du main deck complétée avec des cartes génériques */
  fillerShare: number;
  /** Proximité d'une liste de tournoi (0..1), si basé sur un archétype du meta */
  metaCoverage: number | null;
  /** Jouable = 40 cartes, légal, et un vrai moteur (pas un tas de cartes génériques) */
  playable: boolean;
}

/** Seuils de jouabilité : au moins la moitié de moteur, au plus un tiers de remplissage. */
export const MIN_ENGINE_SHARE = 0.45;
export const MAX_FILLER_SHARE = 0.35;

/**
 * Note de solidité d'un deck généré. Heuristique volontairement lisible :
 * un bon deck a un moteur dense, joué en 3 exemplaires, des staples, peu de remplissage,
 * et — s'il vient du meta — reprend une bonne part de la liste de tournoi.
 */
export function scoreDeck(
  result: GenerationResult,
  opts: { metaCoverage?: number | null; stapleIds?: Set<number> } = {},
): DeckScore {
  const metaCoverage = opts.metaCoverage ?? null;
  // Un staple reste un staple même s'il fait partie de la liste type (Ash Blossom…)
  const isStaple = (e: GeneratedEntry) => e.source === 'STAPLE' || !!opts.stapleIds?.has(e.cardId);
  const main = result.entries.filter((e) => e.zone === 'MAIN');
  const total = Math.max(result.counts.MAIN, 1);
  const copies = (pred: (e: GeneratedEntry) => boolean) =>
    main.filter(pred).reduce((s, e) => s + e.quantity, 0);

  const engine = main.filter((e) => ENGINE_SOURCES.includes(e.source) && !isStaple(e));
  const engineCopies = engine.reduce((s, e) => s + e.quantity, 0);
  const engineShare = engineCopies / total;
  const staples = copies(isStaple);
  const fillerShare = copies((e) => e.source === 'FILLER') / total;
  const consistency = engineCopies
    ? engine.filter((e) => e.quantity >= 3).reduce((s, e) => s + e.quantity, 0) / engineCopies
    : 0;

  const raw =
    0.4 * Math.min(engineShare / 0.7, 1) +
    0.2 * Math.min(staples / 9, 1) +
    0.2 * consistency +
    0.2 * (metaCoverage ?? Math.min(engineShare, 0.6)) -
    0.5 * Math.max(0, fillerShare - 0.15);

  return {
    score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
    engineShare,
    staples,
    consistency,
    fillerShare,
    metaCoverage,
    playable: result.complete && engineShare >= MIN_ENGINE_SHARE && fillerShare <= MAX_FILLER_SHARE,
  };
}
