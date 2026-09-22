import type { DeckAnalysis, DeckEntry } from './graph';
import { matches } from './parse';
import type { CardAction, SummonMechanic, SynCard } from './types';

export type StepKind =
  | 'NORMAL_SUMMON'
  | 'SPECIAL_SUMMON_SELF'
  | 'ACTIVATE'
  | 'DISCARD'
  | 'SEARCH'
  | 'SPECIAL_SUMMON'
  | 'SEND_GY'
  | 'EXTRA_SUMMON'
  | 'END_PHASE';

export interface ComboStep {
  kind: StepKind;
  /** Carte qui agit (ou qui est invoquée) */
  cardId: number;
  /** Carte visée : ajoutée, invoquée, envoyée */
  targetId?: number;
  materialIds?: number[];
  mechanic?: SummonMechanic;
}

export interface ComboLine {
  starterId: number;
  /** Cartes en main au départ (le starter, plus éventuellement une 2e carte) */
  handIds: number[];
  steps: ComboStep[];
  /** Monstres sur le terrain à la fin */
  endBoard: number[];
  bossId: number | null;
}

const MAX_STEPS = 9;

/**
 * Lignes de combo indicatives : on "joue" chaque starter seul en main, en suivant les
 * liens du graphe (recherches, invocations, envois) et en respectant les déclencheurs
 * (effet d'Invocation Normale, de cimetière, coût "défausse cette carte"…), puis on
 * cherche le meilleur monstre de l'Extra Deck invocable avec le terrain obtenu.
 * Ce n'est pas un simulateur de règles complet : ça montre le "chemin" du deck.
 */
export function findCombos(entries: DeckEntry[], analysis: DeckAnalysis, max = 3): ComboLine[] {
  const byId = new Map(entries.map((e) => [e.card.id, e]));
  const starters = [...analysis.roles]
    .filter(([id, roles]) => roles.includes('STARTER') && byId.get(id)?.zone === 'MAIN')
    .map(([id]) => id)
    .sort((a, b) => outDegree(analysis, b) - outDegree(analysis, a));

  const lines: ComboLine[] = [];
  for (const starterId of starters.slice(0, 8)) {
    const line = simulate([starterId], entries, analysis);
    if (line.steps.length >= 2) lines.push(line);
  }
  // Mains de 2 cartes : un starter + une autre carte qui relance (extender ou autre starter)
  const partners = [...analysis.roles]
    .filter(
      ([id, roles]) =>
        byId.get(id)?.zone === 'MAIN' && (roles.includes('EXTENDER') || roles.includes('STARTER')),
    )
    .map(([id]) => id)
    .slice(0, 8);
  for (const s of starters.slice(0, 6)) {
    for (const p of partners) {
      if (p === s) continue;
      const line = simulate([s, p], entries, analysis);
      if (line.bossId !== null) lines.push(line);
    }
  }
  // Les plus riches d'abord (boss en bout de ligne, puis nombre d'étapes), sans doublon de boss
  // Priorité : finit sur un boss, avec une seule carte si possible, puis la ligne la plus riche
  // Valeur d'une ligne : la force du boss final, moins une pénalité par carte de main requise
  const cardOf = new Map(entries.map((e) => [e.card.id, e.card]));
  const lineValue = (l: ComboLine) =>
    (l.bossId !== null ? 4 + bossValue(cardOf.get(l.bossId)!) : 0) -
    (l.handIds.length - 1) * 3 +
    l.steps.length * 0.2;
  const sorted = lines.sort((a, b) => lineValue(b) - lineValue(a));
  const out: ComboLine[] = [];
  const seen = new Set<string>();
  for (const l of sorted) {
    const key = [...l.handIds].sort((x, y) => x - y).join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

const outDegree = (a: DeckAnalysis, id: number) =>
  a.edges.filter((e) => e.from === id && e.verb !== 'MENTION').length;

function simulate(handIds: number[], entries: DeckEntry[], analysis: DeckAnalysis): ComboLine {
  const starterId = handIds[0]!;
  const cards = new Map(entries.map((e) => [e.card.id, e.card]));
  const zoneOf = new Map(entries.map((e) => [e.card.id, e.zone]));
  const f = (id: number) => analysis.features.get(id)!;
  const steps: ComboStep[] = [];
  const field: SynCard[] = [];
  const usedEffects = new Set<string>();
  const touched = new Set<number>(handIds);
  const gy: number[] = [];
  const hand = new Set<number>(handIds);
  let normalSummonUsed = false;

  /** Cibles possibles d'un effet, en respectant l'endroit où elles doivent se trouver. */
  const targetsOf = (id: number, action: CardAction) => {
    const fromDeck = action.from.includes('DECK');
    const inPlace = (cid: number) =>
      fromDeck ||
      (action.from.includes('GY') && gy.includes(cid)) ||
      (action.from.includes('HAND') && hand.has(cid));
    return analysis.edges
      .filter((e) => e.from === id && e.verb === action.verb && zoneOf.get(e.to) === 'MAIN')
      .filter((e) => (fromDeck ? !touched.has(e.to) : inPlace(e.to)))
      .map((e) => cards.get(e.to)!)
      .filter((c) => action.filters.some((fl) => matches(c, fl, f(c.id), action.from)));
  };

  /**
   * Meilleure cible selon ce qu'on en fait : on envoie au cimetière une carte qui a un effet
   * de cimetière, on invoque une carte qui a un effet à l'invocation, on cherche une carte
   * qu'on pourra jouer tout de suite.
   */
  const best = (xs: SynCard[], verb: CardAction['verb']) =>
    [...xs].sort((a, b) => value(b, verb) - value(a, verb))[0];
  const value = (c: SynCard, verb: CardAction['verb']) => {
    const roles = analysis.roles.get(c.id) ?? [];
    const acts = f(c.id).actions;
    let v =
      (roles.includes('STARTER') ? 2 : 0) +
      (roles.includes('EXTENDER') ? 2 : 0) +
      (c.level ?? 0) / 10;
    if (verb === 'SEND_GY')
      v += acts.some((a) => a.trigger === 'SENT_GY' || a.trigger === 'END_PHASE_GY') ? 6 : 0;
    if (verb === 'SPECIAL_SUMMON')
      v += acts.filter((a) => ['SS', 'NS_OR_SS', 'IGNITION'].includes(a.trigger)).length * 2;
    if (verb === 'SEARCH' || verb === 'RECOVER') {
      const playable =
        c.category !== 'MONSTER' ||
        f(c.id).selfSummon ||
        (!normalSummonUsed && (c.level ?? 0) <= 4);
      v += playable ? 4 : 0;
      v += acts.some((a) => a.fromHand) ? 2 : 0;
    }
    if (/\bTuner\b/.test(c.type)) v += 1; // les syntoniseurs ouvrent les Synchro
    // Anticipation : ce monstre sur le terrain permet-il un meilleur boss ?
    if (verb === 'SPECIAL_SUMMON' && c.category === 'MONSTER') {
      const now = bestExtraSummon(field, entries, analysis);
      const next = bestExtraSummon([...field, c], entries, analysis);
      v += Math.max(0, (next ? bossValue(next.card) : 0) - (now ? bossValue(now.card) : 0)) / 2;
    }
    return v;
  };

  const run = (id: number, allowed: (a: CardAction) => boolean) => {
    for (const [i, action] of f(id).actions.entries()) {
      if (steps.length >= MAX_STEPS) return;
      const key = `${id}:${i}`;
      if (usedEffects.has(key) || !allowed(action)) continue;
      if (f(id).oncePerTurn && [...usedEffects].some((k) => k.startsWith(`${id}:`))) continue;
      const target = best(targetsOf(id, action), action.verb);
      if (!target) continue;
      usedEffects.add(key);
      touched.add(target.id);
      switch (action.verb) {
        case 'SEARCH':
        case 'RECOVER':
          steps.push({ kind: 'SEARCH', cardId: id, targetId: target.id });
          hand.add(target.id);
          playFromHand(target.id);
          break;
        case 'SPECIAL_SUMMON':
          steps.push({ kind: 'SPECIAL_SUMMON', cardId: id, targetId: target.id });
          hand.delete(target.id);
          gy.splice(gy.indexOf(target.id) >>> 0, gy.includes(target.id) ? 1 : 0);
          field.push(target);
          run(target.id, (a) => !a.fromHand && ['SS', 'NS_OR_SS', 'IGNITION'].includes(a.trigger));
          break;
        case 'SEND_GY':
          steps.push({ kind: 'SEND_GY', cardId: id, targetId: target.id });
          hand.delete(target.id);
          gy.push(target.id);
          run(target.id, (a) => a.trigger === 'SENT_GY');
          break;
        default:
          break;
      }
    }
  };

  const playFromHand = (id: number) => {
    if (steps.length >= MAX_STEPS) return;
    const c = cards.get(id)!;
    const feat = f(id);
    hand.delete(id);
    if (c.category !== 'MONSTER') {
      steps.push({ kind: 'ACTIVATE', cardId: id });
      run(id, () => true);
      return;
    }
    if (feat.selfSummon) {
      steps.push({ kind: 'SPECIAL_SUMMON_SELF', cardId: id });
      field.push(c);
      run(id, (a) => !a.fromHand && a.trigger !== 'NS' && a.trigger !== 'SENT_GY');
      return;
    }
    if (!normalSummonUsed && !feat.cannotNormalSummon) {
      normalSummonUsed = true;
      steps.push({ kind: 'NORMAL_SUMMON', cardId: id });
      field.push(c);
      run(id, (a) => !a.fromHand && ['NS', 'NS_OR_SS', 'IGNITION'].includes(a.trigger));
      return;
    }
    // Invocation Normale déjà utilisée : on se sert de l'effet "défausse cette carte" s'il existe
    if (feat.actions.some((a) => a.fromHand)) {
      steps.push({ kind: 'DISCARD', cardId: id });
      gy.push(id);
      run(id, (a) => a.fromHand || a.trigger === 'SENT_GY');
    }
  };

  for (const id of handIds) playFromHand(id);

  // Fin de ligne : meilleur monstre de l'Extra Deck invocable avec le terrain
  const boss = bestExtraSummon(field, entries, analysis);
  if (boss) {
    steps.push({
      kind: 'EXTRA_SUMMON',
      cardId: boss.card.id,
      materialIds: boss.materials.map((m) => m.id),
      mechanic: boss.mechanic,
    });
    for (const m of boss.materials) {
      field.splice(field.indexOf(m), 1);
      gy.push(m.id);
    }
    field.push(boss.card);
    // Matériaux envoyés au cimetière : effets "sent to the GY" / End Phase (White Stones…)
    for (const m of boss.materials) {
      const act = f(m.id).actions.find(
        (a) => a.trigger === 'SENT_GY' || a.trigger === 'END_PHASE_GY',
      );
      if (!act) continue;
      const target = best(targetsOf(m.id, act), act.verb);
      if (!target) continue;
      touched.add(target.id);
      steps.push({
        kind:
          act.trigger === 'END_PHASE_GY'
            ? 'END_PHASE'
            : act.verb === 'SEARCH'
              ? 'SEARCH'
              : 'SPECIAL_SUMMON',
        cardId: m.id,
        targetId: target.id,
      });
    }
  }

  return {
    starterId,
    handIds,
    steps,
    endBoard: field.map((c) => c.id),
    bossId: boss?.card.id ?? null,
  };
}

/** Force approximative d'un monstre d'Extra Deck (niveau / rang, ou 2 × valeur Lien). */
const bossValue = (c: SynCard) => (c.linkVal ? c.linkVal * 2 : (c.level ?? 0));

/** Parmi les monstres Extra atteignables, celui qu'on peut poser avec les monstres sur le terrain. */
function bestExtraSummon(
  field: SynCard[],
  entries: DeckEntry[],
  analysis: DeckAnalysis,
): { card: SynCard; materials: SynCard[]; mechanic: SummonMechanic } | null {
  const extras = entries
    .filter((e) => e.zone === 'EXTRA')
    .map((e) => e.card)
    .sort((a, b) => (b.level ?? b.linkVal ?? 0) - (a.level ?? a.linkVal ?? 0));
  for (const card of extras) {
    const m = analysis.features.get(card.id)?.materials;
    if (!m || m.exotic) continue;
    const feat = (c: SynCard) => analysis.features.get(c.id);
    if (m.mechanic === 'SYNCHRO' && m.tuner && m.nonTuner && m.level) {
      const tuners = field.filter((c) => matches(c, m.tuner!.filter, feat(c)));
      const nons = field.filter(
        (c) => !/\bTuner\b/.test(c.type) && matches(c, m.nonTuner!.filter, feat(c)),
      );
      for (const t of tuners) {
        for (const n of nons) {
          if ((t.level ?? 0) + (n.level ?? 0) === m.level)
            return { card, materials: [t, n], mechanic: 'SYNCHRO' };
        }
      }
    }
    if (m.mechanic === 'XYZ' && m.level) {
      const ok = field.filter(
        (c) => c.level === m.level && (!m.filter || matches(c, m.filter, feat(c))),
      );
      if (ok.length >= (m.count ?? 2))
        return { card, materials: ok.slice(0, m.count ?? 2), mechanic: 'XYZ' };
    }
    if (m.mechanic === 'LINK') {
      const ok = field.filter((c) => !m.filter || matches(c, m.filter, feat(c)));
      if (ok.length >= (m.count ?? 2))
        return { card, materials: ok.slice(0, m.count ?? 2), mechanic: 'LINK' };
    }
    if (m.mechanic === 'FUSION' && /Special Summoned by sending the above/i.test(card.desc)) {
      const used: SynCard[] = [];
      const ok = m.parts.every((p) => {
        const hit = field.find((c) => !used.includes(c) && matches(c, p.filter, feat(c)));
        if (hit) used.push(hit);
        return !!hit;
      });
      if (ok) return { card, materials: used, mechanic: 'FUSION' };
    }
  }
  return null;
}
