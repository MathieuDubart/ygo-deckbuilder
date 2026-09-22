import { DECK_RULES, maxCopiesFor } from '@ygo/shared';
import type { DeckTemplate, TemplateCard, Zone } from './types';

export interface GenCardInfo {
  id: number;
  isExtraDeck: boolean;
  banTcg: string | null;
}

export type EntrySource = 'CORE' | 'FLEX' | 'STAPLE' | 'ARCHETYPE' | 'SUPPORT';

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

interface Ctx {
  cards: Map<number, GenCardInfo>;
  owned: Map<number, number>;
  onlyOwned: boolean;
  mainTarget: number;
}

/**
 * Remplit un deck à partir de candidats classés par priorité, en respectant :
 * zone (Extra ⇄ Main), limite de 3 / banlist, taille des zones, et — en mode
 * "mes cartes" — les exemplaires réellement possédés (consommés une seule fois
 * même si la carte est dans plusieurs zones).
 */
export function fillDeck(candidates: Candidate[], ctx: Ctx): GenerationResult {
  const entries = new Map<string, GeneratedEntry>();
  const inDeck = new Map<number, number>();
  const remaining = new Map(ctx.owned);
  const counts: Record<Zone, number> = { MAIN: 0, EXTRA: 0, SIDE: 0 };
  const cap: Record<Zone, number> = {
    MAIN: ctx.mainTarget,
    EXTRA: DECK_RULES.EXTRA.max,
    SIDE: DECK_RULES.SIDE.max,
  };

  for (const c of candidates) {
    const info = ctx.cards.get(c.cardId);
    if (!info) continue;
    const zone: Zone = c.zone === 'SIDE' ? 'SIDE' : info.isExtraDeck ? 'EXTRA' : 'MAIN';
    const limit = maxCopiesFor(info.banTcg) - (inDeck.get(c.cardId) ?? 0);
    const available = remaining.get(c.cardId) ?? 0;
    let q = Math.min(c.want, limit, cap[zone] - counts[zone]);
    if (ctx.onlyOwned) q = Math.min(q, available);
    if (q <= 0) continue;

    const owned = Math.min(q, available);
    remaining.set(c.cardId, available - owned);
    inDeck.set(c.cardId, (inDeck.get(c.cardId) ?? 0) + q);
    counts[zone] += q;

    const key = `${zone}:${c.cardId}`;
    const prev = entries.get(key);
    entries.set(key, {
      cardId: c.cardId,
      zone,
      quantity: (prev?.quantity ?? 0) + q,
      owned: (prev?.owned ?? 0) + owned,
      source: prev?.source ?? c.source,
      inclusion: prev?.inclusion ?? c.inclusion ?? null,
    });
  }

  const list = [...entries.values()];
  return {
    entries: list,
    counts,
    missingCopies: list.reduce((s, e) => s + e.quantity - e.owned, 0),
    complete: counts.MAIN >= DECK_RULES.MAIN.min,
  };
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

/**
 * Deck basé sur un archétype du meta.
 *  - META : la liste type telle quelle (on indique juste ce qui manque)
 *  - OWNED : uniquement tes cartes — cœur de la liste, puis cartes flex de l'archétype,
 *            puis staples génériques que tu possèdes, puis cartes de l'archétype.
 */
export function generateFromTemplate(
  template: DeckTemplate,
  opts: {
    mode: 'META' | 'OWNED';
    cards: Map<number, GenCardInfo>;
    owned: Map<number, number>;
    staples: Staple[];
    archetypeCards: number[];
  },
): GenerationResult {
  const core = template.cards.filter((c) => c.zone !== 'SIDE').sort(byInclusion);
  const side = template.cards.filter((c) => c.zone === 'SIDE').sort(byInclusion);
  const ctx: Ctx = {
    cards: opts.cards,
    owned: opts.owned,
    onlyOwned: opts.mode === 'OWNED',
    mainTarget: template.mainSize,
  };

  if (opts.mode === 'META') {
    return fillDeck(
      [...core, ...side].map((c) => fromTemplate(c, 'CORE')),
      ctx,
    );
  }

  return fillDeck(
    [
      ...core.map((c) => fromTemplate(c, 'CORE')),
      ...template.flex
        .filter((c) => c.zone !== 'SIDE')
        .sort(byInclusion)
        .map((c) => fromTemplate(c, 'FLEX')),
      ...opts.staples.map((s) => ({
        cardId: s.cardId,
        want: Math.max(1, Math.round(s.avgCopies)),
        source: 'STAPLE' as const,
      })),
      ...opts.archetypeCards.map((id) => ({ cardId: id, want: 3, source: 'ARCHETYPE' as const })),
      ...side.map((c) => fromTemplate(c, 'CORE')),
    ],
    ctx,
  );
}

/**
 * Deck "maison" à partir d'un archétype de ta collection (pas de liste de tournoi) :
 * cartes de l'archétype, cartes qui le supportent, puis staples possédés.
 */
export function generateFromArchetype(opts: {
  cards: Map<number, GenCardInfo>;
  owned: Map<number, number>;
  archetypeCards: number[];
  supportCards: number[];
  staples: Staple[];
}): GenerationResult {
  return fillDeck(
    [
      ...opts.archetypeCards.map((id) => ({ cardId: id, want: 3, source: 'ARCHETYPE' as const })),
      ...opts.supportCards.map((id) => ({ cardId: id, want: 2, source: 'SUPPORT' as const })),
      ...opts.staples.map((s) => ({
        cardId: s.cardId,
        want: Math.max(1, Math.round(s.avgCopies)),
        source: 'STAPLE' as const,
      })),
    ],
    { cards: opts.cards, owned: opts.owned, onlyOwned: true, mainTarget: DECK_RULES.MAIN.min },
  );
}
