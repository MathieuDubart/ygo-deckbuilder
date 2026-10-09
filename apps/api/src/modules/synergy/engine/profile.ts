import type { DeckAnalysis, DeckEntry } from './graph';

/**
 * Ce qu'un deck SAIT FAIRE, et contre quoi ça marche.
 *
 * Un duel ne se joue pas deck contre deck mais plan contre plan : un deck combo se fait
 * arrêter par ce qui agit depuis la main, un deck à verrous se fait casser par ce qui
 * nettoie un terrain, un deck de contrôle perd contre ce qui va plus vite que lui. Tout
 * l'objet de ce fichier est de rendre ces trois phrases calculables.
 *
 * Les axes sont volontairement peu nombreux et tous normalisés sur 0..1, ramenés à un main
 * deck de 40 cartes. Ils ne décrivent pas une force absolue — un axe haut n'est pas « mieux »
 * — mais une FORME, et c'est la confrontation de deux formes qui donne un pronostic.
 *
 * Pur, sans I/O : la même fonction profile un deck de l'utilisateur et une liste du meta.
 */

/** Taille de référence : les axes se lisent « pour un deck de 40 cartes ». */
const MAIN_REFERENCE = 40;

export type DeckStyle = 'COMBO' | 'MIDRANGE' | 'CONTROL' | 'STUN' | 'BEATDOWN';
export const DECK_STYLES: readonly DeckStyle[] = [
  'COMBO',
  'MIDRANGE',
  'CONTROL',
  'STUN',
  'BEATDOWN',
];

/** Les axes d'un profil. Nommés par ce qu'ils permettent, pas par les cartes qui les portent. */
export interface DeckProfile {
  style: DeckStyle;
  /** Capacité à poser un plateau à son propre tour. */
  setup: number;
  /** Interaction pendant le tour adverse, depuis le terrain (pièges, négations posées). */
  disruption: number;
  /** Interaction DEPUIS LA MAIN : la seule qui existe au tout premier tour adverse. */
  handInteraction: number;
  /** Capacité à défaire un plateau déjà posé. */
  breaking: number;
  /** Verrous continus : ce qui interdit, plutôt que ce qui répond. */
  lock: number;
  /** Capacité à rejouer après s'être fait casser. */
  resilience: number;
  /** Régularité : la probabilité d'ouvrir sur son plan. */
  consistency: number;
}

type Axis = Exclude<keyof DeckProfile, 'style'>;

export type MatchupVerdict = 'GOOD' | 'EVEN' | 'BAD';

/**
 * Pourquoi le pronostic est ce qu'il est. Une clé, pas une phrase : le texte vit côté
 * client, dans les cinq langues.
 */
export type MatchupReason =
  | 'HAND_TRAPS'
  | 'NO_HAND_TRAPS'
  | 'BREAKERS'
  | 'NO_BREAKERS'
  | 'LOCK'
  | 'FRAGILE_SETUP'
  | 'DISRUPTION'
  | 'NO_DISRUPTION'
  | 'RESILIENCE'
  | 'BALANCED';

export interface Matchup {
  /** Le style adverse jugé. */
  against: DeckStyle;
  verdict: MatchupVerdict;
  reason: MatchupReason;
  /** −1..1, pour trier et pour nuancer l'affichage. */
  edge: number;
}

/** Comptages bruts tirés du deck, avant normalisation. */
export interface ProfileCounts {
  mainCopies: number;
  starters: number;
  handTraps: number;
  interruptions: number;
  removal: number;
  floodgates: number;
  boardBreakers: number;
  recovery: number;
  searchers: number;
  traps: number;
}

/** Les comptages qui servent au profil, en un passage sur le main deck. */
export function countProfile(entries: DeckEntry[], analysis: DeckAnalysis): ProfileCounts {
  const main = entries.filter((e) => e.zone === 'MAIN');
  let floodgates = 0;
  let boardBreakers = 0;
  let traps = 0;
  for (const entry of main) {
    const f = analysis.features.get(entry.card.id);
    if (!f) continue;
    if (f.floodgate) floodgates += entry.quantity;
    if (f.boardBreaker) boardBreakers += entry.quantity;
    if (entry.card.category === 'TRAP') traps += entry.quantity;
  }
  const rc = analysis.roleCopies;
  return {
    mainCopies: main.reduce((sum, e) => sum + e.quantity, 0),
    starters: rc.STARTER,
    handTraps: rc.HAND_TRAP,
    interruptions: rc.INTERRUPTION,
    removal: rc.REMOVAL,
    floodgates,
    boardBreakers,
    recovery: rc.RECOVERY,
    searchers: rc.SEARCHER,
    traps,
  };
}

/** Ramène un nombre d'exemplaires à 0..1, pour un main de 40 cartes, saturé à `full`. */
const share = (copies: number, mainCopies: number, full: number): number => {
  if (copies <= 0 || full <= 0) return 0;
  const per40 = (copies * MAIN_REFERENCE) / Math.max(MAIN_REFERENCE, mainCopies);
  return Math.min(1, per40 / full);
};

/**
 * Le style d'un deck, dans l'ordre où les signes se lisent.
 *
 * L'ordre compte : un deck à verrous joue aussi des pièges, et un deck combo cherche aussi
 * des cartes. On regarde donc d'abord ce qui est le plus déterminant — un verrou change la
 * nature de la partie — puis on descend vers le plus commun.
 */
function styleOf(counts: ProfileCounts, synergyScore: number): DeckStyle {
  const per40 = (n: number) => (n * MAIN_REFERENCE) / Math.max(MAIN_REFERENCE, counts.mainCopies);
  // Quatre verrous : au-delà, ce n'est plus un appoint, c'est le plan de jeu
  if (per40(counts.floodgates) >= 4) return 'STUN';
  // Beaucoup de pièges et peu de démarrages : on laisse venir
  if (per40(counts.traps + counts.interruptions) >= 12 && per40(counts.starters) < 10) {
    return 'CONTROL';
  }
  // Beaucoup de démarrages ET des cartes qui se parlent : on enchaîne
  if (per40(counts.starters) >= 10 && synergyScore >= 0.45) return 'COMBO';
  // Ni verrou, ni pièges, ni enchaînement : on frappe
  if (per40(counts.removal) >= 4 && synergyScore < 0.3) return 'BEATDOWN';
  return 'MIDRANGE';
}

/** Le profil complet d'un deck, à partir de son analyse de synergie. */
export function profileDeck(entries: DeckEntry[], analysis: DeckAnalysis): DeckProfile {
  const c = countProfile(entries, analysis);
  const n = c.mainCopies;
  return {
    style: styleOf(c, analysis.synergy.score),
    // Un plateau se pose avec des démarrages qui se trouvent : les deux comptent
    setup: Math.min(1, share(c.starters, n, 14) * 0.6 + analysis.synergy.score * 0.4),
    disruption: share(c.interruptions + c.traps, n, 12),
    handInteraction: share(c.handTraps, n, 9),
    breaking: share(c.boardBreakers + c.removal, n, 8),
    lock: share(c.floodgates, n, 6),
    resilience: share(c.recovery + c.searchers, n, 12),
    consistency: share(c.searchers + c.starters, n, 18),
  };
}

/**
 * Ce qui compte face à chaque style, et ce qui se paie.
 *
 * `helps` : l'axe fait gagner du terrain. `hurts` : l'axe est une prise, parce qu'il donne
 * à l'adversaire quelque chose à attaquer — dépendre d'un plateau face à un deck à verrous
 * en est l'exemple pur.
 */
const AGAINST: Record<DeckStyle, { helps: Partial<Record<Axis, number>>; hurts: Partial<Record<Axis, number>> }> = {
  // On les arrête pendant LEUR tour, ou pas du tout : la main et les verrous. Un piège posé
  // arrive trop tard quand c'est l'adversaire qui commence.
  COMBO: { helps: { handInteraction: 1, lock: 0.6, disruption: 0.2 }, hurts: {} },
  // La partie va durer : il faut casser ce qu'ils posent et revenir après leurs échanges.
  CONTROL: { helps: { breaking: 0.9, resilience: 0.7, setup: 0.3 }, hurts: {} },
  // Un verrou ne se négocie pas depuis la main : il faut le retirer. Et plus notre plan
  // dépend d'un plateau, plus il fait mal.
  STUN: { helps: { breaking: 1, resilience: 0.3 }, hurts: { setup: 0.6 } },
  // Ils frappent tôt : il faut répondre tôt, et tenir le terrain.
  BEATDOWN: { helps: { disruption: 0.8, breaking: 0.4, setup: 0.4 }, hurts: {} },
  // Pas de prise évidente : c'est la régularité et l'interaction qui tranchent.
  MIDRANGE: { helps: { disruption: 0.5, breaking: 0.4, setup: 0.4, consistency: 0.3 }, hurts: {} },
};

/**
 * Le mot qui explique un axe, dans chaque direction.
 *
 * Une direction sans mot est volontaire : il n'y a rien d'utile à dire à quelqu'un qui
 * « manque de verrous » ou qui « manque de régularité » face à un style donné — ce n'est
 * pas ce qu'il faut changer. Un axe muet ne sert donc jamais d'explication, même quand
 * c'est lui qui pèse le plus, et on remonte au suivant.
 */
const REASON: Partial<Record<Axis, { good?: MatchupReason; bad?: MatchupReason }>> = {
  handInteraction: { good: 'HAND_TRAPS', bad: 'NO_HAND_TRAPS' },
  breaking: { good: 'BREAKERS', bad: 'NO_BREAKERS' },
  disruption: { good: 'DISRUPTION', bad: 'NO_DISRUPTION' },
  lock: { good: 'LOCK' },
  resilience: { good: 'RESILIENCE' },
  setup: { bad: 'FRAGILE_SETUP' },
};

/** Au-delà, le pronostic penche ; en deçà, les deux decks se valent. */
const TIPPING = 0.12;

/**
 * Le pronostic d'un deck face à un autre.
 *
 * `theirs` est facultatif : on sait déjà beaucoup de choses en ne connaissant que le STYLE
 * adverse, et c'est ce qui permet de donner un pronostic même sans meta synchronisé. Quand
 * le profil adverse est connu, il nuance — leurs cartes de main et leurs verrous nous
 * ralentissent d'autant plus que notre plan dépend d'un plateau.
 */
export function matchup(
  mine: DeckProfile,
  against: DeckStyle,
  theirs?: DeckProfile,
): Matchup {
  const { helps, hurts } = AGAINST[against];
  let total = 0;
  let edge = 0;
  let explanation: MatchupReason | null = null;
  let best = 0;

  /** Retient l'axe qui pèse le plus, parmi ceux qui ont quelque chose à dire. */
  const consider = (axis: Axis, contribution: number) => {
    const word = contribution >= 0 ? REASON[axis]?.good : REASON[axis]?.bad;
    if (!word || Math.abs(contribution) <= Math.abs(best)) return;
    best = contribution;
    explanation = word;
  };

  for (const [axis, weight] of Object.entries(helps) as [Axis, number][]) {
    // Centré sur 0.5 : un axe moyen ne fait ni gagner ni perdre
    const contribution = weight * (mine[axis] - 0.5) * 2;
    edge += contribution;
    total += weight;
    consider(axis, contribution);
  }
  for (const [axis, weight] of Object.entries(hurts) as [Axis, number][]) {
    const contribution = -weight * mine[axis];
    edge += contribution;
    total += weight;
    consider(axis, contribution);
  }

  if (theirs) {
    // Ce qu'ILS nous font : leurs cartes de main et leurs verrous mordent sur notre plan,
    // d'autant plus que celui-ci demande à poser un plateau.
    edge -= (theirs.handInteraction * 0.5 + theirs.lock * 0.7) * mine.setup;
    // Et ce qu'on leur reprend : revenir après s'être fait casser
    edge += mine.resilience * theirs.breaking * 0.3;
    total += 0.5;
  }

  const normalized = total > 0 ? Math.max(-1, Math.min(1, edge / total)) : 0;
  const verdict: MatchupVerdict =
    normalized >= TIPPING ? 'GOOD' : normalized <= -TIPPING ? 'BAD' : 'EVEN';
  // Un pronostic équilibré n'a pas de cause : le dire serait inventer une explication.
  const reason: MatchupReason = verdict === 'EVEN' ? 'BALANCED' : (explanation ?? 'BALANCED');
  return { against, verdict, reason, edge: Math.round(normalized * 100) / 100 };
}

/** Les cinq pronostics d'un deck, du plus favorable au moins favorable. */
export function allMatchups(mine: DeckProfile): Matchup[] {
  return DECK_STYLES.map((style) => matchup(mine, style)).sort((a, b) => b.edge - a.edge);
}
