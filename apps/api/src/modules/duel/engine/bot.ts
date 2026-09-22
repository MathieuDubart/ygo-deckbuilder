import {
  cardMatchesOpcode,
  OcgLocation,
  OcgMessageType,
  OcgPosition,
  OcgResponseType,
  OcgType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type OcgCardData,
  type OcgMessage,
  type OcgResponse,
} from 'ocgcore-wasm';
import type { DuelPhase } from '@ygo/shared';
import { autoResponse, type SelectMessage } from './prompts';

/** Monstre sur le Terrain, vu par le bot (stats inconnues pour un monstre adverse face verso). */
export interface BotMonster {
  code: number;
  sequence: number;
  position: number;
  attack: number;
  defense: number;
  /** false : monstre adverse face verso, le bot ne « triche » pas */
  known: boolean;
}

/** Ce que le bot peut lire du duel au moment de décider. */
export interface BotWorld {
  /** Équipe du moteur jouée par le bot */
  team: 0 | 1;
  turnPlayer: 0 | 1;
  phase: DuelPhase;
  monsters: (team: 0 | 1) => BotMonster[];
  info: (code: number) => OcgCardData | null;
  /** Cartes adverses déjà vues (Terrain, Cimetière, bannies) : pour déclarer un nom */
  knownOpponentCodes: () => number[];
  /** Dernier HINT SELECTMSG du moteur (HINTMSG_*) */
  hintCode: number | null;
}

// HINTMSG_* de constant.lua : ce qu'on va faire des cartes choisies
const HINT = {
  ATTACK_TARGET: 549,
} as const;
/** Choisir ses propres cartes pour ça leur fait du mal : on sacrifie les moins utiles. */
const HARMFUL_HINTS = new Set([
  500, 501, 502, 503, 504, 505, 507, 511, 512, 513, 519, 521, 531, 532, 533, 579,
]);

/** Plafonds anti-boucle : une action tentée trop souvent dans le tour est abandonnée. */
const MAX_TRIES_PER_ACTION = 2;
const MAX_ACTIONS_PER_TURN = 40;
/** DEF supposée d'un monstre adverse face verso */
const UNKNOWN_DEFENSE = 1500;

const is = (type: number | undefined, flag: number) => ((type ?? 0) & flag) !== 0;
const EXTRA_TYPES = OcgType.FUSION | OcgType.SYNCHRO | OcgType.XYZ | OcgType.LINK;

type CardRef = { code: number; controller: number; location: number; sequence: number };

/**
 * Adversaire automatique, pour n'importe quel deck : il développe son Terrain (effets,
 * Invocations Spéciales puis Normale, cartes posées), attaque quand le combat lui est
 * favorable et réagit à tes actions avec ses hand traps et ses pièges.
 * Heuristiques simples et déterministes ; une instance par duel (elle se souvient du tour).
 */
export class DuelBot {
  private turn = 0;
  private tries = new Map<string, number>();
  private actions = 0;
  /** Tu viens d'agir (activation, Invocation, attaque) : fenêtre pour une réponse */
  private threat = false;
  /** Cible choisie en déclarant l'attaque (séquence du monstre adverse) */
  private attackTarget: number | null = null;

  /** Suit les messages du moteur (tous, y compris ceux destinés au bot). */
  observe(msg: OcgMessage, team: 0 | 1): void {
    switch (msg.type) {
      case OcgMessageType.NEW_TURN:
        this.turn += 1;
        this.tries.clear();
        this.actions = 0;
        this.threat = false;
        break;
      case OcgMessageType.NEW_PHASE:
        this.threat = false;
        break;
      case OcgMessageType.CHAINING:
        if (msg.controller !== team) this.threat = true;
        break;
      case OcgMessageType.SUMMONING:
      case OcgMessageType.SPSUMMONING:
      case OcgMessageType.FLIPSUMMONING:
        if (msg.controller !== team) this.threat = true;
        break;
      case OcgMessageType.ATTACK:
        if (msg.card.controller !== team) this.threat = true;
        break;
      case OcgMessageType.CHAIN_END:
        this.threat = false;
        break;
      default:
        break;
    }
  }

  /**
   * Réponse du bot. `attempt` > 0 : le moteur a refusé la précédente → on se replie sur la
   * réponse passive, qui est toujours valide ou presque.
   */
  respond(msg: SelectMessage, world: BotWorld, attempt = 0): OcgResponse {
    if (attempt > 0) return autoResponse(msg);
    switch (msg.type) {
      case OcgMessageType.SELECT_IDLECMD:
        return this.idle(msg, world);
      case OcgMessageType.SELECT_BATTLECMD:
        return this.battle(msg, world);
      case OcgMessageType.SELECT_CHAIN:
        return this.chain(msg, world);
      case OcgMessageType.SELECT_EFFECTYN:
        // Effets optionnels (déclencheurs) : presque toujours avantageux
        return { type: OcgResponseType.SELECT_EFFECTYN, yes: true };
      case OcgMessageType.SELECT_YESNO:
        return { type: OcgResponseType.SELECT_YESNO, yes: true };
      case OcgMessageType.SELECT_CARD: {
        const picked = this.pick(msg.selects, msg.min, msg.max, world);
        return { type: OcgResponseType.SELECT_CARD, indicies: picked };
      }
      case OcgMessageType.SELECT_TRIBUTE:
        return { type: OcgResponseType.SELECT_TRIBUTE, indicies: this.tributes(msg, world) };
      case OcgMessageType.SELECT_SUM:
        return { type: OcgResponseType.SELECT_SUM, indicies: this.sum(msg, world) };
      case OcgMessageType.SELECT_UNSELECT_CARD:
        return this.unselect(msg, world);
      case OcgMessageType.SELECT_POSITION:
        return { type: OcgResponseType.SELECT_POSITION, position: this.position(msg, world) };
      case OcgMessageType.ANNOUNCE_CARD:
        return { type: OcgResponseType.ANNOUNCE_CARD, card: this.announce(msg, world) };
      default:
        return autoResponse(msg);
    }
  }

  // MARK: - Main Phase

  private idle(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_IDLECMD }>,
    world: BotWorld,
  ): OcgResponse {
    const choose = (action: SelectIdleCMDAction, index: number, key: string): OcgResponse => {
      this.bump(key);
      this.actions += 1;
      return { type: OcgResponseType.SELECT_IDLECMD, action, index };
    };
    const fresh = (key: string) => (this.tries.get(key) ?? 0) < MAX_TRIES_PER_ACTION;
    const end = (): OcgResponse => {
      const attackers = world
        .monsters(world.team)
        .some((m) => m.position === OcgPosition.FACEUP_ATTACK);
      const action =
        msg.to_bp && world.phase === 'MAIN1' && attackers
          ? SelectIdleCMDAction.TO_BP
          : msg.to_ep
            ? SelectIdleCMDAction.TO_EP
            : SelectIdleCMDAction.TO_BP;
      return { type: OcgResponseType.SELECT_IDLECMD, action, index: null };
    };
    if (this.actions >= MAX_ACTIONS_PER_TURN) return end();

    const mine = world.monsters(world.team);
    const theirs = world.monsters((1 - world.team) as 0 | 1);
    const threat = Math.max(0, ...theirs.map((m) => (m.known ? m.attack : 0)));
    const info = (code: number) => world.info(code);

    // 1. Effets : Magies Terrain d'abord, puis le reste (pas les Pièges, gardés pour ton tour)
    const rank = (c: CardRef): number => {
      const type = info(c.code)?.type;
      if (is(type, OcgType.FIELD)) return 3;
      if (c.location === OcgLocation.HAND && is(type, OcgType.SPELL)) return 2;
      return 1;
    };
    const activates = msg.activates
      .map((c, index) => ({ c, index, key: `A:${c.code}:${c.description}:${c.location}` }))
      .filter(({ c, key }) => fresh(key) && !is(info(c.code)?.type, OcgType.TRAP))
      .sort((a, b) => rank(b.c) - rank(a.c));
    const activate = activates[0];
    if (activate) return choose(SelectIdleCMDAction.SELECT_ACTIVATE, activate.index, activate.key);

    // 2. Invocations Spéciales (procédures d'Extra Deck, Pendule, effets de main)
    const specials = msg.special_summons
      .map((c, index) => ({
        c,
        index,
        key: `S:${c.code}:${c.location}`,
        atk: info(c.code)?.attack ?? 0,
      }))
      .filter(({ c, key, atk }) => {
        if (!fresh(key)) return false;
        // Un Monstre d'Extra Deck consomme des matériels : seulement s'il vaut le coup
        const fromExtra = c.location === OcgLocation.EXTRA || is(info(c.code)?.type, EXTRA_TYPES);
        return !fromExtra || atk >= Math.max(1500, ...mine.map((m) => m.attack));
      })
      .sort((a, b) => b.atk - a.atk);
    const special = specials[0];
    if (special)
      return choose(SelectIdleCMDAction.SELECT_SPECIAL_SUMMON, special.index, special.key);

    // 3. Invocation Normale du meilleur monstre, ou Pose s'il ne tient pas face à ton Terrain
    const best = msg.summons
      .map((c, index) => ({ c, index, data: info(c.code) }))
      .filter(({ c }) => fresh(`N:${c.code}`))
      .sort((a, b) => (b.data?.attack ?? 0) - (a.data?.attack ?? 0))[0];
    const bestSet = msg.monster_sets
      .map((c, index) => ({ c, index, data: info(c.code) }))
      .filter(({ c }) => fresh(`M:${c.code}`))
      .sort((a, b) => (b.data?.defense ?? 0) - (a.data?.defense ?? 0))[0];
    if (best) {
      const atk = best.data?.attack ?? 0;
      const hasEffect = is(best.data?.type, OcgType.EFFECT);
      if (atk >= threat || !theirs.length || hasEffect || !bestSet)
        return choose(SelectIdleCMDAction.SELECT_SUMMON, best.index, `N:${best.c.code}`);
    }
    if (bestSet)
      return choose(SelectIdleCMDAction.SELECT_MONSTER_SET, bestSet.index, `M:${bestSet.c.code}`);

    // 4. Positions : en Attaque si le monstre domine, en Défense en Main Phase 2 s'il est dominé
    for (const [index, c] of msg.pos_changes.entries()) {
      const key = `P:${c.sequence}`;
      const m = mine.find((x) => x.sequence === c.sequence);
      if (!m || !fresh(key)) continue;
      const inDefense =
        (m.position & (OcgPosition.FACEUP_DEFENSE | OcgPosition.FACEDOWN_DEFENSE)) !== 0;
      if (inDefense && world.phase === 'MAIN1' && m.attack > threat && m.attack > 0)
        return choose(SelectIdleCMDAction.SELECT_POS_CHANGE, index, key);
      if (!inDefense && world.phase === 'MAIN2' && m.attack < threat && m.defense > m.attack)
        return choose(SelectIdleCMDAction.SELECT_POS_CHANGE, index, key);
    }

    // 5. Pose les Pièges et Magies Jeu-Rapide pour le tour adverse
    const set = msg.spell_sets
      .map((c, index) => ({ c, index, type: info(c.code)?.type }))
      .find(
        ({ c, type }) =>
          fresh(`T:${c.code}`) && (is(type, OcgType.TRAP) || is(type, OcgType.QUICKPLAY)),
      );
    if (set) return choose(SelectIdleCMDAction.SELECT_SPELL_SET, set.index, `T:${set.c.code}`);

    return end();
  }

  // MARK: - Battle Phase

  private battle(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_BATTLECMD }>,
    world: BotWorld,
  ): OcgResponse {
    const mine = world.monsters(world.team);
    const theirs = world.monsters((1 - world.team) as 0 | 1);
    let bestAttack: { index: number; gain: number; target: number | null } | null = null;
    for (const [index, a] of msg.attacks.entries()) {
      const key = `B:${a.sequence}`;
      if ((this.tries.get(key) ?? 0) >= 1) continue;
      const atk = mine.find((m) => m.sequence === a.sequence)?.attack ?? 0;
      if (a.can_direct && !theirs.length) {
        bestAttack = pickBetter(bestAttack, { index, gain: atk + 10_000, target: null });
        continue;
      }
      for (const t of theirs) {
        const win = beats(atk, t);
        if (win === null) continue;
        bestAttack = pickBetter(bestAttack, { index, gain: win, target: t.sequence });
      }
      if (a.can_direct) bestAttack = pickBetter(bestAttack, { index, gain: atk, target: null });
    }
    if (bestAttack) {
      this.bump(`B:${msg.attacks[bestAttack.index]!.sequence}`);
      this.attackTarget = bestAttack.target;
      return {
        type: OcgResponseType.SELECT_BATTLECMD,
        action: SelectBattleCMDAction.SELECT_BATTLE,
        index: bestAttack.index,
      };
    }
    return {
      type: OcgResponseType.SELECT_BATTLECMD,
      action: msg.to_m2 ? SelectBattleCMDAction.TO_M2 : SelectBattleCMDAction.TO_EP,
      index: null,
    };
  }

  // MARK: - Chaînes

  private chain(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_CHAIN }>,
    world: BotWorld,
  ): OcgResponse {
    if (msg.forced) return { type: OcgResponseType.SELECT_CHAIN, index: 0 };
    const threat = this.threat;
    this.threat = false;
    if (!threat) return { type: OcgResponseType.SELECT_CHAIN, index: null };
    // Tu viens d'agir : hand traps et Pièges posés en priorité
    const options = msg.selects
      .map((c, index) => ({ c, index, key: `C:${c.code}:${c.description}` }))
      .filter(({ key }) => (this.tries.get(key) ?? 0) < 1)
      .sort((a, b) => reactivity(b.c, world) - reactivity(a.c, world));
    const choice = options[0];
    if (!choice) return { type: OcgResponseType.SELECT_CHAIN, index: null };
    this.bump(choice.key);
    return { type: OcgResponseType.SELECT_CHAIN, index: choice.index };
  }

  // MARK: - Sélections

  /** Choisit min (au moins 1) cartes : les meilleures des tiennes à viser, les moins utiles des siennes à sacrifier. */
  private pick(cards: CardRef[], min: number, max: number, world: BotWorld): number[] {
    if (!cards.length) return [];
    const count = Math.min(Math.max(min, 1), max, cards.length);
    if (world.hintCode === HINT.ATTACK_TARGET && this.attackTarget !== null) {
      const target = cards.findIndex(
        (c) =>
          c.controller !== world.team &&
          c.location === OcgLocation.MZONE &&
          c.sequence === this.attackTarget,
      );
      this.attackTarget = null;
      if (target >= 0 && count === 1) return [target];
    }
    const harmful = world.hintCode !== null && HARMFUL_HINTS.has(world.hintCode);
    return cards
      .map((c, i) => ({ i, score: this.score(c, harmful, world) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((x) => x.i);
  }

  private score(c: CardRef, harmful: boolean, world: BotWorld): number {
    const value = cardValue(c, world);
    if (c.controller !== world.team) return 100_000 + value;
    return harmful ? -value : value;
  }

  private tributes(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_TRIBUTE }>,
    world: BotWorld,
  ): number[] {
    const ordered = msg.selects
      .map((c, i) => ({ i, value: cardValue(c, world), weight: Math.max(1, c.release_param) }))
      .sort((a, b) => a.value - b.value);
    const out: number[] = [];
    let total = 0;
    for (const c of ordered) {
      if (total >= msg.min || out.length >= msg.max) break;
      out.push(c.i);
      total += c.weight;
    }
    return out;
  }

  /** Matériels dont la somme des Niveaux atteint le total : les moins utiles d'abord. */
  private sum(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_SUM }>,
    world: BotWorld,
  ): number[] {
    const must = msg.selects_must.reduce((s, c) => s + (c.amount & 0xffff), 0);
    const target = msg.amount - must;
    const ordered = msg.selects
      .map((c, i) => ({ i, value: cardValue(c, world), levels: levelsOf(c.amount) }))
      .sort((a, b) => a.value - b.value);
    return findSum(ordered, target) ?? autoSum(msg);
  }

  private unselect(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_UNSELECT_CARD }>,
    world: BotWorld,
  ): OcgResponse {
    const selected = msg.unselect_cards.length;
    if ((msg.can_finish && selected >= Math.max(1, msg.min)) || !msg.select_cards.length)
      return { type: OcgResponseType.SELECT_UNSELECT_CARD, index: null };
    const [best] = this.pick(msg.select_cards, 1, 1, world);
    return { type: OcgResponseType.SELECT_UNSELECT_CARD, index: best ?? 0 };
  }

  private position(
    msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_POSITION }>,
    world: BotWorld,
  ): OcgPosition {
    const data = world.info(msg.code);
    const theirs = world.monsters((1 - world.team) as 0 | 1);
    const threat = Math.max(0, ...theirs.map((m) => (m.known ? m.attack : 0)));
    const attack = (data?.attack ?? 0) >= threat || !theirs.length;
    const order = attack
      ? [OcgPosition.FACEUP_ATTACK, OcgPosition.FACEUP_DEFENSE, OcgPosition.FACEDOWN_DEFENSE]
      : [OcgPosition.FACEUP_DEFENSE, OcgPosition.FACEDOWN_DEFENSE, OcgPosition.FACEUP_ATTACK];
    return (order.find((p) => msg.positions & p) ?? OcgPosition.FACEUP_ATTACK) as OcgPosition;
  }

  /** Déclare une carte vue chez toi qui respecte les conditions de l'effet. */
  private announce(
    msg: Extract<SelectMessage, { type: OcgMessageType.ANNOUNCE_CARD }>,
    world: BotWorld,
  ): number {
    for (const code of world.knownOpponentCodes()) {
      const data = world.info(code);
      if (data && cardMatchesOpcode(data, msg.opcodes)) return code;
    }
    return world.knownOpponentCodes()[0] ?? 0;
  }

  private bump(key: string): void {
    this.tries.set(key, (this.tries.get(key) ?? 0) + 1);
  }
}

// MARK: - Évaluations

/** Gain d'une attaque sur ce monstre (null = mauvaise idée). */
export function beats(atk: number, target: BotMonster): number | null {
  if (!target.known) return atk > UNKNOWN_DEFENSE ? 500 : null;
  const attackPosition = (target.position & OcgPosition.FACEUP_ATTACK) !== 0;
  if (attackPosition) return atk > target.attack ? 1000 + target.attack : null;
  return atk > target.defense ? 500 + target.attack : null;
}

function pickBetter<T extends { gain: number }>(a: T | null, b: T): T {
  return !a || b.gain > a.gain ? b : a;
}

/** Valeur d'une carte pour le bot : ATK réelle sur le Terrain, sinon d'après ses données. */
export function cardValue(c: CardRef, world: BotWorld): number {
  if (c.location === OcgLocation.MZONE) {
    const m = world.monsters(c.controller as 0 | 1).find((x) => x.sequence === c.sequence);
    if (m) return m.known ? Math.max(m.attack, m.defense) + 200 : UNKNOWN_DEFENSE;
  }
  const data = c.code ? world.info(c.code) : null;
  if (!data) return 1000;
  if (is(data.type, OcgType.TOKEN)) return 100;
  if (is(data.type, OcgType.MONSTER))
    return Math.max(data.attack, data.defense) + (is(data.type, EXTRA_TYPES) ? 500 : 0);
  return 1200;
}

/** Priorité d'une réponse : hand traps, puis Pièges posés, puis le reste. */
function reactivity(c: CardRef, world: BotWorld): number {
  const type = world.info(c.code)?.type;
  if (c.location === OcgLocation.HAND && is(type, OcgType.MONSTER)) return 3;
  if (c.location === OcgLocation.SZONE && is(type, OcgType.TRAP)) return 2;
  return 1;
}

/** Une carte peut compter pour deux Niveaux (16 bits bas / hauts). */
function levelsOf(amount: number): number[] {
  const low = amount & 0xffff;
  const high = amount >>> 16;
  return high && high !== low ? [low, high] : [low];
}

/** Sous-ensemble dont la somme vaut exactement `target` (recherche bornée). */
export function findSum(cards: { i: number; levels: number[] }[], target: number): number[] | null {
  if (target <= 0) return [];
  let steps = 0;
  const walk = (from: number, left: number, acc: number[]): number[] | null => {
    if (left === 0) return acc;
    if (left < 0 || ++steps > 20_000) return null;
    for (let k = from; k < cards.length; k++) {
      for (const lv of cards[k]!.levels) {
        const found = walk(k + 1, left - lv, [...acc, cards[k]!.i]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(0, target, []);
}

function autoSum(msg: Extract<SelectMessage, { type: OcgMessageType.SELECT_SUM }>): number[] {
  const r = autoResponse(msg);
  return r.type === OcgResponseType.SELECT_SUM ? (r.indicies ?? []) : [];
}
