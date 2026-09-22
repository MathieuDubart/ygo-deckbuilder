import type { ComboLine, ComboStep } from './combos';
import type { DeckAnalysis, DeckEntry } from './graph';
import type { Translator } from '../../../common/i18n/translator';
import type { Role } from './types';

/**
 * Guide de jeu "à base de règles" : tout est déduit de l'analyse (rôles, liens, combos,
 * Extra Deck). Pas de texte inventé : chaque phrase s'appuie sur une carte du deck.
 * Un modèle de langage peut ensuite reformuler / enrichir (cf. AiGuideService).
 */

export interface GuideStat {
  label: string;
  value: string;
  hint: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

export interface GuideKeyCard {
  cardId: number;
  roles: Role[];
  why: string;
}

export interface GuideComboStep {
  text: string;
  cardIds: number[];
}

export interface GuideCombo {
  title: string;
  handIds: number[];
  steps: GuideComboStep[];
  endBoardIds: number[];
}

export interface RuleGuide {
  /** false = effets illisibles : guide réduit au minimum */
  readable: boolean;
  summary: string;
  styles: string[];
  stats: GuideStat[];
  gamePlan: string[];
  keyCards: GuideKeyCard[];
  combos: GuideCombo[];
  goingFirst: string[];
  goingSecond: string[];
  mistakes: string[];
}

/** Probabilité d'avoir au moins 1 des `hits` cartes en piochant `draw` cartes dans `deck`. */
export function openingOdds(hits: number, deck: number, draw = 5): number {
  if (hits <= 0) return 0;
  if (hits >= deck) return 1;
  let miss = 1;
  for (let i = 0; i < draw; i++) miss *= (deck - hits - i) / (deck - i);
  return 1 - Math.max(0, miss);
}

export function buildRuleGuide(
  entries: DeckEntry[],
  analysis: DeckAnalysis,
  combos: ComboLine[],
  name: (id: number) => string,
  tr: Translator,
): RuleGuide {
  const { t, list } = tr;
  const pct = tr.percent;
  const q = (id: number) => tr.quote(name(id));
  const mech = (m: string) => t(`mechanics.${m}`);
  const main = entries.filter((e) => e.zone === 'MAIN');
  const mainSize = Math.max(
    main.reduce((s, e) => s + e.quantity, 0),
    1,
  );
  const qty = new Map(entries.map((e) => [e.card.id, e.quantity]));
  const card = new Map(entries.map((e) => [e.card.id, e.card]));
  const withRole = (r: Role) =>
    main.filter((e) => analysis.roles.get(e.card.id)?.includes(r)).map((e) => e.card.id);
  const out = (id: number, verb: string) =>
    analysis.edges.filter((e) => e.from === id && e.verb === verb && e.to !== id).map((e) => e.to);

  const starters = withRole('STARTER');
  const extenders = withRole('EXTENDER').filter((id) => !starters.includes(id));
  const handTraps = withRole('HAND_TRAP');
  const interruptions = withRole('INTERRUPTION');
  const removal = withRole('REMOVAL');
  const rc = analysis.roleCopies;
  const reachable = analysis.extra.filter((x) => x.reachable);
  const unreachable = analysis.extra.filter((x) => x.reachable === false);
  const bosses = reachable
    .map((x) => card.get(x.cardId)!)
    .sort((a, b) => (b.level ?? b.linkVal ?? 0) - (a.level ?? a.linkVal ?? 0));
  const traps = main.filter((e) => e.card.category === 'TRAP').reduce((s, e) => s + e.quantity, 0);
  const gyTriggers = main
    .filter((e) => analysis.features.get(e.card.id)?.sentToGyTrigger)
    .map((e) => e.card.id);

  // ─── Style ──────────────────────────────────────────────────────────────
  const styles: string[] = [];
  const mechanics = new Map<string, number>();
  for (const x of reachable) mechanics.set(x.mechanic, (mechanics.get(x.mechanic) ?? 0) + 1);
  for (const [m] of [...mechanics].sort((a, b) => b[1] - a[1]).slice(0, 2)) {
    styles.push(mech(m));
  }
  if (main.some((e) => analysis.features.get(e.card.id)?.ritualEnabler))
    styles.push(t('styles.ritual'));
  if (rc.STARTER >= 10 && analysis.synergy.connectedShare >= 0.5) styles.push(t('styles.combo'));
  if (traps >= 8) styles.push(t('styles.control'));
  if (gyTriggers.length >= 3) styles.push(t('styles.graveyard'));
  if (rc.HAND_TRAP >= 6) styles.push(t('styles.handTraps'));
  if (!styles.length) styles.push(t(rc.REMOVAL >= 4 ? 'styles.beatdown' : 'styles.midrange'));

  const odds5 = openingOdds(rc.STARTER, mainSize, 5);
  const odds6 = openingOdds(rc.STARTER, mainSize, 6);
  const archetypes = [...new Set(main.map((e) => e.card.archetype).filter(Boolean))] as string[];
  const topArchetype = archetypes
    .map((a) => ({
      a,
      n: main.filter((e) => e.card.archetype === a).reduce((s, e) => s + e.quantity, 0),
    }))
    .sort((x, y) => y.n - x.n)[0]?.a;

  const styleText = styles.slice(0, 3).join(' / ');
  const summary = [
    topArchetype
      ? t('guide.summary.styleArchetype', { styles: styleText, archetype: tr.quote(topArchetype) })
      : t('guide.summary.styleOnly', { styles: styleText }),
    bosses.length
      ? t('guide.summary.bosses', {
          bosses: list(
            bosses.slice(0, 3).map((b) => q(b.id)),
            3,
          ),
        })
      : t('guide.summary.noBoss'),
    rc.STARTER
      ? t('guide.summary.starters', { count: rc.STARTER, odds5: pct(odds5), odds6: pct(odds6) })
      : t('guide.summary.noStarter'),
  ].join(' ');

  // ─── Stats ──────────────────────────────────────────────────────────────
  const tone = (ok: boolean, meh: boolean): GuideStat['tone'] =>
    ok ? 'good' : meh ? 'warn' : 'bad';
  const stat = (key: string, value: string, tone: GuideStat['tone'], params = {}) => ({
    label: t(`guide.stats.${key}.label`),
    value,
    hint: t(`guide.stats.${key}.hint`, params),
    tone,
  });
  const stats: GuideStat[] = [
    stat('starters', String(rc.STARTER), tone(odds5 >= 0.85, odds5 >= 0.65), { odds: pct(odds5) }),
    stat('extenders', String(rc.EXTENDER), tone(rc.EXTENDER >= 6, rc.EXTENDER >= 3)),
    // Hand traps : pas obligatoires, juste conseillées
    stat('handTraps', String(rc.HAND_TRAP), rc.HAND_TRAP >= 6 ? 'good' : 'warn'),
    stat(
      'extra',
      analysis.extra.every((x) => x.reachable === null)
        ? '?'
        : `${reachable.length}/${analysis.extra.length}`,
      analysis.extra.length ? tone(!unreachable.length, unreachable.length <= 2) : 'neutral',
    ),
    stat(
      'linked',
      pct(analysis.synergy.connectedShare),
      tone(analysis.synergy.connectedShare >= 0.6, analysis.synergy.connectedShare >= 0.4),
    ),
  ];
  if (rc.INTERRUPTION + rc.REMOVAL > 0) {
    stats.push(stat('interactions', String(rc.INTERRUPTION + rc.REMOVAL), 'neutral'));
  }

  // ─── Plan de jeu ────────────────────────────────────────────────────────
  const gamePlan: string[] = [];
  if (starters.length) {
    gamePlan.push(t('guide.plan.starters', { cards: list(starters.map(q), 5) }));
  }
  // Chaînes de recherche A → B → C (le "chemin" du moteur)
  const chains: string[] = [];
  for (const a of starters) {
    for (const b of out(a, 'SEARCH')) {
      const c = out(b, 'SEARCH').find((x) => x !== a);
      if (c) chains.push(t('guide.plan.chain', { a: q(a), b: q(b), c: q(c) }));
    }
  }
  if (chains.length) gamePlan.push(chains[0]!);
  // Moteur de cimetière : qui envoie quoi, pour déclencher quoi
  for (const id of gyTriggers.slice(0, 2)) {
    const enablers = analysis.edges
      .filter((e) => e.to === id && e.verb === 'SEND_GY')
      .map((e) => e.from);
    const materialOf = reachable.some((x) => x.materialIds.includes(id));
    const how = [...enablers.map(q), ...(materialOf ? [t('guide.plan.asMaterial')] : [])];
    if (how.length) gamePlan.push(t('guide.plan.gyTrigger', { card: q(id), how: list(how, 3) }));
  }
  if (bosses.length) {
    const b = bosses[0]!;
    const check = reachable.find((x) => x.cardId === b.id)!;
    const mats = check.materialIds.slice(0, 3).map(q);
    gamePlan.push(
      mats.length
        ? t('guide.plan.endBoardWith', {
            boss: q(b.id),
            mechanic: mech(check.mechanic),
            materials: list(mats, 3),
          })
        : t('guide.plan.endBoard', { boss: q(b.id), mechanic: mech(check.mechanic) }),
    );
  }
  if (rc.DRAW) {
    gamePlan.push(t('guide.plan.draw', { cards: list(withRole('DRAW').map(q), 3) }));
  }

  // ─── Cartes clés ────────────────────────────────────────────────────────
  const weight: Partial<Record<Role, number>> = {
    STARTER: 5,
    SEARCHER: 3,
    EXTENDER: 3,
    BOSS: 4,
    HAND_TRAP: 2,
    INTERRUPTION: 2,
    REMOVAL: 2,
  };
  const degree = (id: number) =>
    analysis.edges.filter(
      (e) => e.verb !== 'MENTION' && e.from !== e.to && (e.from === id || e.to === id),
    ).length;
  const keyCards: GuideKeyCard[] = entries
    .filter((e) => e.zone !== 'SIDE')
    .map((e) => {
      const roles = analysis.roles.get(e.card.id) ?? [];
      return {
        e,
        roles,
        w: roles.reduce((s, r) => s + (weight[r] ?? 1), 0) + degree(e.card.id) * 0.5,
      };
    })
    .filter((x) => x.roles.length)
    .sort((a, b) => b.w - a.w)
    .slice(0, 8)
    .map(({ e, roles }) => ({
      cardId: e.card.id,
      roles,
      why: explainCard(e.card.id, analysis, q, card, tr),
    }));

  // ─── Combos ─────────────────────────────────────────────────────────────
  const guideCombos: GuideCombo[] = combos.map((c) => ({
    title:
      c.handIds.length > 1
        ? c.handIds.map(q).join(' + ')
        : t('guide.combo.alone', { card: q(c.starterId) }),
    handIds: c.handIds,
    steps: c.steps.map((s) => stepText(s, q, card, tr)),
    endBoardIds: c.endBoard,
  }));

  // ─── Premier / second ───────────────────────────────────────────────────
  const goingFirst: string[] = [];
  if (bosses.length) {
    goingFirst.push(
      t('guide.first.combo', {
        bosses: list(
          bosses.slice(0, 2).map((b) => q(b.id)),
          2,
        ),
      }),
    );
  }
  const negaters = bosses.filter((b) => analysis.features.get(b.id)?.negates);
  if (negaters.length) {
    goingFirst.push(
      t('guide.first.negaters', {
        count: Math.min(negaters.length, 3),
        cards: list(
          negaters.slice(0, 3).map((b) => q(b.id)),
          3,
        ),
      }),
    );
  }
  if (traps) goingFirst.push(t('guide.first.traps', { count: traps }));
  goingFirst.push(t('guide.first.handTrapCheck'));

  const goingSecond: string[] = [];
  if (handTraps.length) {
    goingSecond.push(t('guide.second.handTraps', { cards: list(handTraps.map(q), 4) }));
  }
  goingSecond.push(
    removal.length
      ? t('guide.second.removal', { cards: list(removal.map(q), 4) })
      : t('guide.second.noRemoval'),
  );
  goingSecond.push(t('guide.second.extraDraw'));

  // ─── Erreurs à éviter ───────────────────────────────────────────────────
  const mistakes: string[] = [];
  if (analysis.normalSummonStarters.length >= 2) {
    mistakes.push(
      t('guide.mistakes.normalSummon', { cards: list(analysis.normalSummonStarters.map(q), 4) }),
    );
  }
  const opt = analysis.oncePerTurn.filter((id) => (qty.get(id) ?? 0) >= 2);
  if (opt.length) mistakes.push(t('guide.mistakes.oncePerTurn', { cards: list(opt.map(q), 4) }));
  mistakes.push(t('guide.mistakes.freeFirst'));
  if (gyTriggers.length) {
    mistakes.push(
      t('guide.mistakes.gyTriggers', { cards: list(gyTriggers.slice(0, 3).map(q), 3) }),
    );
  }
  if (handTraps.length) mistakes.push(t('guide.mistakes.handTrapTiming'));
  for (const id of analysis.bricks.slice(0, 2)) {
    mistakes.push(t('guide.mistakes.brick', { card: q(id) }));
  }
  for (const x of unreachable.slice(0, 3)) {
    mistakes.push(t('guide.mistakes.unreachable', { card: q(x.cardId) }));
  }
  const thinStarters = starters.filter((id) => (qty.get(id) ?? 0) < 3);
  if (rc.STARTER < 8 && thinStarters.length) {
    mistakes.push(t('guide.mistakes.fewStarters', { cards: list(thinStarters.map(q), 3) }));
  }

  // Textes illisibles (absents, ou tournures que le lecteur ne connaît pas) : on le dit
  // clairement plutôt que d'afficher des conseils faux ("aucun starter"…)
  const readable =
    analysis.edges.some((e) => e.verb !== 'MENTION') || rc.HAND_TRAP + rc.REMOVAL + rc.DRAW > 0;
  if (!readable) {
    return {
      summary: t('guide.summary.unreadable', {
        subject: topArchetype
          ? t('guide.summary.unreadableArchetype', { archetype: tr.quote(topArchetype) })
          : t('guide.summary.unreadableDeck'),
      }),
      styles: styles.filter((st) => st !== t('styles.midrange') && st !== t('styles.beatdown')),
      stats: [],
      gamePlan: [],
      keyCards: [],
      combos: [],
      goingFirst: [],
      goingSecond: [],
      mistakes: [t('guide.mistakes.freeFirst')],
      readable: false,
    };
  }

  return {
    readable: true,
    summary,
    styles,
    stats,
    gamePlan,
    keyCards,
    combos: guideCombos,
    goingFirst,
    goingSecond,
    mistakes,
  };
}

function explainCard(
  id: number,
  a: DeckAnalysis,
  q: (id: number) => string,
  card: Map<number, DeckEntry['card']>,
  tr: Translator,
): string {
  const { t, list } = tr;
  const verbs = ['SEARCH', 'SPECIAL_SUMMON', 'SEND_GY', 'RECOVER'] as const;
  const parts: string[] = [];
  const isExtra = !!card.get(id)?.isExtraDeck;
  for (const verb of isExtra ? [] : verbs) {
    const targets = [
      ...new Set(
        a.edges.filter((e) => e.from === id && e.verb === verb && e.to !== id).map((e) => e.to),
      ),
    ];
    if (targets.length) parts.push(t(`guide.explain.${verb}`, { cards: list(targets.map(q), 3) }));
  }
  const f = a.features.get(id);
  const by = [
    ...new Set(
      a.edges
        .filter((e) => e.to === id && e.from !== id && e.verb !== 'MENTION')
        .map((e) => e.from),
    ),
  ];
  if (!parts.length && by.length) {
    parts.push(t('guide.explain.accessible', { cards: list(by.map(q), 3) }));
  }
  if (f?.selfSummon) parts.push(t('guide.explain.selfSummon'));
  if (f?.handTrap) parts.push(t('guide.explain.handTrap'));
  else if (f?.negates) parts.push(t('guide.explain.negates'));
  if (f?.removal) parts.push(t('guide.explain.removal'));
  if (f?.draws) parts.push(t('guide.explain.draws'));
  const x = a.extra.find((e) => e.cardId === id);
  if (x?.reachable && x.materialIds.length) {
    parts.push(
      t('guide.explain.summonableWith', { cards: list(x.materialIds.slice(0, 3).map(q), 3) }),
    );
  }
  if (!parts.length) return t(isExtra ? 'guide.explain.extraOption' : 'guide.explain.support');
  const s = parts.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

function stepText(
  s: ComboStep,
  q: (id: number) => string,
  card: Map<number, DeckEntry['card']>,
  tr: Translator,
): GuideComboStep {
  const { t } = tr;
  const target = s.targetId;
  const one = (text: string) => ({ text, cardIds: [s.cardId] });
  const two = (text: string) => ({ text, cardIds: [s.cardId, target!] });
  switch (s.kind) {
    case 'NORMAL_SUMMON':
    case 'SPECIAL_SUMMON_SELF':
    case 'ACTIVATE':
    case 'DISCARD':
      return one(t(`guide.steps.${s.kind}`, { card: q(s.cardId) }));
    case 'SEARCH':
    case 'SPECIAL_SUMMON':
    case 'SEND_GY':
    case 'END_PHASE':
      return two(t(`guide.steps.${s.kind}`, { card: q(s.cardId), target: q(target!) }));
    case 'EXTRA_SUMMON': {
      const mats = s.materialIds ?? [];
      const mechanic = card.get(s.cardId)?.frameType.startsWith('link')
        ? t('mechanics.LINK')
        : s.mechanic
          ? t(`mechanics.${s.mechanic}`)
          : '';
      return {
        text: mats.length
          ? t('guide.steps.EXTRA_SUMMON_WITH', {
              mechanic,
              card: q(s.cardId),
              materials: mats.map(q).join(' + '),
            })
          : t('guide.steps.EXTRA_SUMMON', { mechanic, card: q(s.cardId) }),
        cardIds: [s.cardId, ...mats],
      };
    }
    default:
      return { text: '', cardIds: [] };
  }
}
