import type { ComboLine, ComboStep } from './combos';
import type { DeckAnalysis, DeckEntry } from './graph';
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

export const ROLE_LABELS: Record<Role, string> = {
  STARTER: 'Starter',
  SEARCHER: 'Chercheur',
  EXTENDER: 'Extender',
  HAND_TRAP: 'Hand trap',
  INTERRUPTION: 'Interruption',
  REMOVAL: 'Destruction',
  DRAW: 'Pioche',
  RECOVERY: 'Récupération',
  FUSION_ENABLER: 'Fusion',
  RITUAL_ENABLER: 'Rituel',
  BOSS: 'Boss',
};

const MECHANIC_FR = {
  FUSION: 'Fusion',
  SYNCHRO: 'Synchro',
  XYZ: 'Xyz',
  LINK: 'Lien',
  RITUAL: 'Rituelle',
} as const;

/** Probabilité d'avoir au moins 1 des `hits` cartes en piochant `draw` cartes dans `deck`. */
export function openingOdds(hits: number, deck: number, draw = 5): number {
  if (hits <= 0) return 0;
  if (hits >= deck) return 1;
  let miss = 1;
  for (let i = 0; i < draw; i++) miss *= (deck - hits - i) / (deck - i);
  return 1 - Math.max(0, miss);
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const list = (xs: string[], max = 4) => {
  const shown = xs.slice(0, max);
  const more = xs.length - shown.length;
  const body =
    shown.length > 1 ? `${shown.slice(0, -1).join(', ')} et ${shown.at(-1)}` : (shown[0] ?? '');
  return more > 0 ? `${body} (+${more})` : body;
};

export function buildRuleGuide(
  entries: DeckEntry[],
  analysis: DeckAnalysis,
  combos: ComboLine[],
  name: (id: number) => string,
): RuleGuide {
  const q = (id: number) => `« ${name(id)} »`;
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
    styles.push(MECHANIC_FR[m as keyof typeof MECHANIC_FR] ?? m);
  }
  if (main.some((e) => analysis.features.get(e.card.id)?.ritualEnabler)) styles.push('Rituel');
  if (rc.STARTER >= 10 && analysis.synergy.connectedShare >= 0.5) styles.push('Combo');
  if (traps >= 8) styles.push('Contrôle');
  if (gyTriggers.length >= 3) styles.push('Cimetière');
  if (rc.HAND_TRAP >= 6) styles.push('Hand traps');
  if (!styles.length) styles.push(rc.REMOVAL >= 4 ? 'Beatdown' : 'Midrange');

  const odds5 = openingOdds(rc.STARTER, mainSize, 5);
  const odds6 = openingOdds(rc.STARTER, mainSize, 6);
  const archetypes = [...new Set(main.map((e) => e.card.archetype).filter(Boolean))] as string[];
  const topArchetype = archetypes
    .map((a) => ({
      a,
      n: main.filter((e) => e.card.archetype === a).reduce((s, e) => s + e.quantity, 0),
    }))
    .sort((x, y) => y.n - x.n)[0]?.a;

  const summary = [
    `Deck ${styles.slice(0, 3).join(' / ')}${topArchetype ? ` construit autour des « ${topArchetype} »` : ''}.`,
    bosses.length
      ? `Il cherche à poser ${list(
          bosses.slice(0, 3).map((b) => q(b.id)),
          3,
        )} depuis l'Extra Deck.`
      : 'Il joue surtout avec son Main Deck (peu d’Extra Deck exploitable).',
    rc.STARTER
      ? `Avec ${rc.STARTER} starters, tu en as un dans ta main de départ ${pct(odds5)} du temps (${pct(odds6)} en jouant second).`
      : 'Aucun starter clair : le deck risque d’ouvrir sans rien pouvoir lancer.',
  ].join(' ');

  // ─── Stats ──────────────────────────────────────────────────────────────
  const tone = (ok: boolean, meh: boolean): GuideStat['tone'] =>
    ok ? 'good' : meh ? 'warn' : 'bad';
  const stats: GuideStat[] = [
    {
      label: 'Starters',
      value: String(rc.STARTER),
      hint: `Cartes qui lancent le jeu seules. Main de départ avec au moins un starter : ${pct(odds5)}.`,
      tone: tone(odds5 >= 0.85, odds5 >= 0.65),
    },
    {
      label: 'Extenders',
      value: String(rc.EXTENDER),
      hint: 'Cartes qui prolongent un combo (s’invoquent seules, ressuscitent…) : utiles si le starter est stoppé.',
      tone: tone(rc.EXTENDER >= 6, rc.EXTENDER >= 3),
    },
    {
      label: 'Hand traps',
      value: String(rc.HAND_TRAP),
      hint: 'Interruptions jouables depuis la main pendant le tour adverse.',
      tone: rc.HAND_TRAP >= 6 ? 'good' : 'warn', // pas obligatoires, juste conseillées
    },
    {
      label: 'Extra invocable',
      value: analysis.extra.every((x) => x.reachable === null)
        ? '?'
        : `${reachable.length}/${analysis.extra.length}`,
      hint: 'Monstres d’Extra Deck qu’on peut réellement invoquer avec les matériaux du Main Deck.',
      tone: analysis.extra.length ? tone(!unreachable.length, unreachable.length <= 2) : 'neutral',
    },
    {
      label: 'Cartes liées',
      value: pct(analysis.synergy.connectedShare),
      hint: 'Part du Main Deck qui cherche, invoque ou est cherchée/invoquée par une autre carte du deck.',
      tone: tone(analysis.synergy.connectedShare >= 0.6, analysis.synergy.connectedShare >= 0.4),
    },
  ];
  if (rc.INTERRUPTION + rc.REMOVAL > 0) {
    stats.push({
      label: 'Interactions',
      value: String(rc.INTERRUPTION + rc.REMOVAL),
      hint: 'Négations et destructions (hors hand traps) pour gérer le terrain adverse.',
      tone: 'neutral',
    });
  }

  // ─── Plan de jeu ────────────────────────────────────────────────────────
  const gamePlan: string[] = [];
  if (starters.length) {
    gamePlan.push(
      `Cherche à ouvrir avec un starter : ${list(starters.map(q), 5)}. Ce sont eux qui vont chercher ou invoquer le reste du moteur depuis le Deck.`,
    );
  }
  // Chaînes de recherche A → B → C (le "chemin" du moteur)
  const chains: string[] = [];
  for (const a of starters) {
    for (const b of out(a, 'SEARCH')) {
      const c = out(b, 'SEARCH').find((x) => x !== a);
      if (c) chains.push(`${q(a)} va chercher ${q(b)}, qui va lui-même chercher ${q(c)}`);
    }
  }
  if (chains.length) gamePlan.push(`Chaîne de recherche clé : ${chains[0]}.`);
  // Moteur de cimetière : qui envoie quoi, pour déclencher quoi
  for (const id of gyTriggers.slice(0, 2)) {
    const enablers = analysis.edges
      .filter((e) => e.to === id && e.verb === 'SEND_GY')
      .map((e) => e.from);
    const materialOf = reachable.some((x) => x.materialIds.includes(id));
    const how = [
      ...enablers.map(q),
      ...(materialOf ? ['en l’utilisant comme matériau d’Invocation'] : []),
    ];
    if (how.length) {
      gamePlan.push(
        `${q(id)} ne fait rien en main : son effet se déclenche au cimetière. Envoie-le avec ${list(how, 3)}.`,
      );
    }
  }
  if (bosses.length) {
    const b = bosses[0]!;
    const check = reachable.find((x) => x.cardId === b.id)!;
    const mats = check.materialIds.slice(0, 3).map(q);
    gamePlan.push(
      `Objectif de fin de tour : ${q(b.id)} (${MECHANIC_FR[check.mechanic as keyof typeof MECHANIC_FR] ?? check.mechanic})${mats.length ? `, avec par exemple ${list(mats, 3)}` : ''}.`,
    );
  }
  if (rc.DRAW) {
    gamePlan.push(
      `Les cartes de pioche (${list(withRole('DRAW').map(q), 3)}) servent à creuser vers tes starters : joue-les tôt dans le tour.`,
    );
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
      why: explainCard(e.card.id, analysis, q, card),
    }));

  // ─── Combos ─────────────────────────────────────────────────────────────
  const guideCombos: GuideCombo[] = combos.map((c) => ({
    title: c.handIds.length > 1 ? c.handIds.map(q).join(' + ') : `${q(c.starterId)} seul`,
    handIds: c.handIds,
    steps: c.steps.map((s) => stepText(s, q, card)),
    endBoardIds: c.endBoard,
  }));

  // ─── Premier / second ───────────────────────────────────────────────────
  const goingFirst: string[] = [];
  if (bosses.length) {
    goingFirst.push(
      `Déroule ton combo jusqu’à ${list(
        bosses.slice(0, 2).map((b) => q(b.id)),
        2,
      )} et garde de quoi interrompre le tour adverse.`,
    );
  }
  const negaters = bosses.filter((b) => analysis.features.get(b.id)?.negates);
  if (negaters.length) {
    goingFirst.push(
      `${list(
        negaters.slice(0, 3).map((b) => q(b.id)),
        3,
      )} peu${negaters.length > 1 ? 'vent' : 't'} nier : c’est ton vrai "mur", privilégie les lignes qui y mènent.`,
    );
  }
  if (traps)
    goingFirst.push(
      `Pose tes pièges (${traps} dans le deck) en fin de tour : ils ne servent qu’une fois posés.`,
    );
  goingFirst.push(
    'Avant de commencer, repère quelle carte adverse (hand trap) pourrait couper ton combo et commence par l’effet le moins grave à perdre.',
  );

  const goingSecond: string[] = [];
  if (handTraps.length) {
    goingSecond.push(
      `Tes hand traps (${list(handTraps.map(q), 4)}) se jouent pendant le tour adverse : garde-les pour l’effet qui lance leur combo (recherche, invocation depuis le Deck).`,
    );
  }
  if (removal.length) {
    goingSecond.push(
      `Pour casser le terrain adverse : ${list(removal.map(q), 4)}. Vise d’abord le monstre qui nie.`,
    );
  } else {
    goingSecond.push(
      'Le deck manque de cartes pour casser un terrain adverse : pense à des "board breakers" génériques (Raigeki, Dark Ruler No More, Evenly Matched…).',
    );
  }
  goingSecond.push(
    'Tu pioches une carte de plus : n’hésite pas à jouer à fond ton combo, l’adversaire a déjà utilisé une partie de ses ressources.',
  );

  // ─── Erreurs à éviter ───────────────────────────────────────────────────
  const mistakes: string[] = [];
  if (analysis.normalSummonStarters.length >= 2) {
    mistakes.push(
      `${list(analysis.normalSummonStarters.map(q), 4)} demandent toutes ton Invocation Normale : avec deux d’entre elles en main, choisis celle qui mène au meilleur combo, l’autre attendra.`,
    );
  }
  const opt = analysis.oncePerTurn.filter((id) => (qty.get(id) ?? 0) >= 2);
  if (opt.length) {
    mistakes.push(
      `${list(opt.map(q), 4)} : effet utilisable 1 fois par tour. En avoir deux en main ne double pas l’effet, garde le 2e exemplaire pour le tour suivant.`,
    );
  }
  mistakes.push(
    'Joue d’abord les cartes qui ne coûtent pas ton Invocation Normale (magies, monstres qui s’invoquent seuls), puis décide quoi Invoquer Normalement.',
  );
  if (gyTriggers.length) {
    mistakes.push(
      `N’Invoque pas Normalement ${list(gyTriggers.slice(0, 3).map(q), 3)} : leur effet ne marche qu’une fois envoyés au cimetière.`,
    );
  }
  if (handTraps.length) {
    mistakes.push(
      'Ne lâche pas une hand trap sur la première carte adverse : attends l’effet qui compte vraiment (souvent la 2e ou 3e activation).',
    );
  }
  for (const id of analysis.bricks.slice(0, 2)) {
    mistakes.push(
      `${q(id)} est difficile à invoquer et rien ne va la chercher : en main de départ, c’est souvent une carte morte. Envisage de la réduire ou de la retirer.`,
    );
  }
  for (const x of unreachable.slice(0, 3)) {
    mistakes.push(
      `${q(x.cardId)} ne peut pas être invoqué avec les matériaux de ce Main Deck : il prend une place inutile dans l’Extra Deck.`,
    );
  }
  const thinStarters = starters.filter((id) => (qty.get(id) ?? 0) < 3);
  if (rc.STARTER < 8 && thinStarters.length) {
    mistakes.push(
      `Peu de starters : si tu peux, monte ${list(thinStarters.map(q), 3)} à 3 exemplaires pour ouvrir plus souvent.`,
    );
  }

  // Textes illisibles (absents, ou tournures que le lecteur ne connaît pas) : on le dit
  // clairement plutôt que d'afficher des conseils faux ("aucun starter"…)
  const readable =
    analysis.edges.some((e) => e.verb !== 'MENTION') || rc.HAND_TRAP + rc.REMOVAL + rc.DRAW > 0;
  if (!readable) {
    return {
      summary: `Les effets de ${topArchetype ? `ces « ${topArchetype} »` : 'ce deck'} n’ont pas pu être analysés automatiquement (textes manquants ou tournures pas encore reconnues). Le guide se limite aux bases : fie-toi au texte des cartes.`,
      styles: styles.filter((st) => st !== 'Midrange' && st !== 'Beatdown'),
      stats: [],
      gamePlan: [],
      keyCards: [],
      combos: [],
      goingFirst: [],
      goingSecond: [],
      mistakes: [
        'Joue d’abord les cartes qui ne coûtent pas ton Invocation Normale (magies, monstres qui s’invoquent seuls), puis décide quoi Invoquer Normalement.',
      ],
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
): string {
  const verbs: [string, string][] = [
    ['SEARCH', 'cherche'],
    ['SPECIAL_SUMMON', 'invoque'],
    ['SEND_GY', 'envoie au cimetière'],
    ['RECOVER', 'récupère'],
  ];
  const parts: string[] = [];
  const isExtra = !!card.get(id)?.isExtraDeck;
  for (const [verb, fr] of isExtra ? [] : verbs) {
    const targets = [
      ...new Set(
        a.edges.filter((e) => e.from === id && e.verb === verb && e.to !== id).map((e) => e.to),
      ),
    ];
    if (targets.length) parts.push(`${fr} ${list(targets.map(q), 3)}`);
  }
  const f = a.features.get(id);
  const by = [
    ...new Set(
      a.edges
        .filter((e) => e.to === id && e.from !== id && e.verb !== 'MENTION')
        .map((e) => e.from),
    ),
  ];
  if (!parts.length && by.length) parts.push(`accessible via ${list(by.map(q), 3)}`);
  if (f?.selfSummon) parts.push('s’invoque toute seule');
  if (f?.handTrap) parts.push('se joue depuis la main pendant le tour adverse');
  else if (f?.negates) parts.push('peut nier une activation');
  if (f?.removal) parts.push('détruit ou retire une carte adverse');
  if (f?.draws) parts.push('fait piocher');
  const x = a.extra.find((e) => e.cardId === id);
  if (x?.reachable && x.materialIds.length) {
    parts.push(`invocable avec ${list(x.materialIds.slice(0, 3).map(q), 3)}`);
  }
  if (!parts.length)
    return card.get(id)?.isExtraDeck ? 'Option d’Extra Deck.' : 'Carte de soutien.';
  const s = parts.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

function stepText(
  s: ComboStep,
  q: (id: number) => string,
  card: Map<number, DeckEntry['card']>,
): GuideComboStep {
  const t = s.targetId;
  switch (s.kind) {
    case 'NORMAL_SUMMON':
      return { text: `Invocation Normale de ${q(s.cardId)}.`, cardIds: [s.cardId] };
    case 'SPECIAL_SUMMON_SELF':
      return {
        text: `Invoque Spécialement ${q(s.cardId)} avec son propre effet.`,
        cardIds: [s.cardId],
      };
    case 'ACTIVATE':
      return { text: `Active ${q(s.cardId)}.`, cardIds: [s.cardId] };
    case 'DISCARD':
      return { text: `Défausse ${q(s.cardId)} pour activer son effet.`, cardIds: [s.cardId] };
    case 'SEARCH':
      return { text: `${q(s.cardId)} ajoute ${q(t!)} à ta main.`, cardIds: [s.cardId, t!] };
    case 'SPECIAL_SUMMON':
      return { text: `${q(s.cardId)} Invoque Spécialement ${q(t!)}.`, cardIds: [s.cardId, t!] };
    case 'SEND_GY':
      return { text: `${q(s.cardId)} envoie ${q(t!)} au cimetière.`, cardIds: [s.cardId, t!] };
    case 'EXTRA_SUMMON': {
      const mats = s.materialIds ?? [];
      const mech = s.mechanic ? MECHANIC_FR[s.mechanic] : '';
      const kind = card.get(s.cardId)?.frameType.startsWith('link')
        ? 'Invocation Lien'
        : `Invocation ${mech}`;
      return {
        text: `${kind} de ${q(s.cardId)}${mats.length ? ` avec ${mats.map(q).join(' + ')}` : ''}.`,
        cardIds: [s.cardId, ...mats],
      };
    }
    case 'END_PHASE':
      return {
        text: `En End Phase, ${q(s.cardId)} (au cimetière) fait venir ${q(t!)} depuis le Deck.`,
        cardIds: [s.cardId, t!],
      };
    default:
      return { text: '', cardIds: [] };
  }
}
