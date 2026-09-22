import { OcgLocation, OcgMessageType, OcgPosition, type OcgMessage } from 'ocgcore-wasm';
import type { DuelCardRef, DuelEventDto, DuelPhase } from '@ygo/shared';
import { toLocation, toPhase, type DuelView } from './view';
import type { Describe, IsHidden } from './prompts';

type EventBody = DuelEventDto extends infer E
  ? E extends DuelEventDto
    ? Omit<E, 'seq' | 'turn'>
    : never
  : never;

/** Ce que le journal et l'en-tête du plateau suivent au fil des messages. */
export interface DuelTracker {
  turn: number;
  turnPlayer: 0 | 1;
  phase: DuelPhase;
  lp: [number, number];
  chain: { card: DuelCardRef; description: string | null }[];
  winner: { winner: 0 | 1 | null; reason: string | null } | null;
  /** Dernier texte d'invite envoyé par le moteur (HINT SELECTMSG) */
  hint: string | null;
  /** …et sa valeur brute (HINTMSG_*), pour le bot */
  hintCode: number | null;
}

export function newTracker(startingLP: number): DuelTracker {
  return {
    turn: 0,
    turnPlayer: 0,
    phase: 'DRAW',
    lp: [startingLP, startingLP],
    chain: [],
    winner: null,
    hint: null,
    hintCode: null,
  };
}

const HINT_SELECTMSG = 3;

/**
 * Applique un message du moteur à l'état suivi et renvoie les événements du journal qu'il
 * produit (point de vue de l'utilisateur ; les cartes cachées gardent un code 0).
 */
export function applyMessage(
  msg: OcgMessage,
  state: DuelTracker,
  ctx: {
    view: DuelView;
    describe: Describe;
    hidden: IsHidden;
    cardName: (code: number) => string | null;
    victoryReason: (reason: number) => string | null;
    /** Passcode de la carte à cet emplacement (0 si cachée ou inconnue) */
    codeAt: (card: { controller: number; location: number; sequence: number }) => number;
  },
): EventBody[] {
  const { view } = ctx;
  const code = (c: { code: number; controller: number; location: number; position?: number }) =>
    ctx.hidden(c) ? 0 : c.code;

  switch (msg.type) {
    case OcgMessageType.NEW_TURN:
      state.turn += 1;
      state.turnPlayer = view.player(msg.player);
      return [{ kind: 'TURN', player: state.turnPlayer }];
    case OcgMessageType.NEW_PHASE: {
      const phase = toPhase(msg.phase);
      if (!phase || phase === state.phase) return [];
      state.phase = phase;
      return [{ kind: 'PHASE', phase }];
    }
    case OcgMessageType.DRAW: {
      const player = view.player(msg.player);
      const own =
        player === 0 || !ctx.hidden({ controller: msg.player, location: OcgLocation.HAND });
      return [
        {
          kind: 'DRAW',
          player,
          count: msg.drawn.length,
          codes: own ? msg.drawn.map((d) => d.code) : [],
        },
      ];
    }
    case OcgMessageType.SUMMONING:
      return [
        { kind: 'SUMMON', player: view.player(msg.controller), code: msg.code, how: 'NORMAL' },
      ];
    case OcgMessageType.SPSUMMONING:
      return [
        { kind: 'SUMMON', player: view.player(msg.controller), code: msg.code, how: 'SPECIAL' },
      ];
    case OcgMessageType.FLIPSUMMONING:
      return [{ kind: 'SUMMON', player: view.player(msg.controller), code: msg.code, how: 'FLIP' }];
    case OcgMessageType.SET:
      return [{ kind: 'SET', player: view.player(msg.controller), code: 0 }];
    case OcgMessageType.CHAINING: {
      const description = ctx.describe(msg.description);
      state.chain.push({ card: view.ref(msg), description });
      return [
        {
          kind: 'ACTIVATE',
          player: view.player(msg.controller),
          code: msg.code,
          chainLink: msg.chain_size,
          description,
        },
      ];
    }
    case OcgMessageType.CHAIN_NEGATED:
    case OcgMessageType.CHAIN_DISABLED:
      return [{ kind: 'CHAIN_NEGATED', chainLink: msg.chain_size }];
    case OcgMessageType.CHAIN_SOLVED:
      state.chain = state.chain.slice(0, Math.max(0, msg.chain_size - 1));
      return [];
    case OcgMessageType.CHAIN_END:
      state.chain = [];
      return [];
    case OcgMessageType.MOVE: {
      const from = toLocation(msg.from.location);
      const to = toLocation(msg.to.location);
      // Les mouvements « internes » (pioche, invocation, pose) ont déjà leur propre événement
      if (
        from === to ||
        (from === 'DECK' && to === 'HAND') ||
        to === 'MZONE' ||
        to === 'SZONE' ||
        to === 'OVERLAY'
      )
        return [];
      const visible =
        to === 'GRAVE' || to === 'BANISHED'
          ? msg.to.position !== OcgPosition.FACEDOWN
            ? msg.card
            : 0
          : code({ code: msg.card, ...msg.from });
      return [{ kind: 'MOVE', player: view.player(msg.from.controller), code: visible, from, to }];
    }
    case OcgMessageType.ATTACK:
      return [
        {
          kind: 'ATTACK',
          player: view.player(msg.card.controller),
          code: ctx.codeAt(msg.card),
          target: msg.target ? ctx.codeAt(msg.target) : null,
        },
      ];
    case OcgMessageType.DAMAGE:
      state.lp[view.player(msg.player)] = Math.max(
        0,
        state.lp[view.player(msg.player)] - msg.amount,
      );
      return [{ kind: 'DAMAGE', player: view.player(msg.player), amount: msg.amount, cost: false }];
    case OcgMessageType.PAY_LPCOST:
      state.lp[view.player(msg.player)] = Math.max(
        0,
        state.lp[view.player(msg.player)] - msg.amount,
      );
      return [{ kind: 'DAMAGE', player: view.player(msg.player), amount: msg.amount, cost: true }];
    case OcgMessageType.RECOVER:
      state.lp[view.player(msg.player)] += msg.amount;
      return [{ kind: 'RECOVER', player: view.player(msg.player), amount: msg.amount }];
    case OcgMessageType.LPUPDATE:
      state.lp[view.player(msg.player)] = msg.lp;
      return [];
    case OcgMessageType.TOSS_COIN:
      return [{ kind: 'COIN', player: view.player(msg.player), results: msg.results }];
    case OcgMessageType.TOSS_DICE:
      return [{ kind: 'DICE', player: view.player(msg.player), results: msg.results }];
    case OcgMessageType.HINT:
      if (msg.hint_type === HINT_SELECTMSG) {
        const value = BigInt(msg.hint);
        state.hintCode = value < 2n ** 31n ? Number(value) : null;
        // Texte système ou d'effet, sinon le nom d'une carte (« où placer X »)
        state.hint = ctx.describe(value) ?? ctx.cardName(Number(value));
      }
      return [];
    case OcgMessageType.WIN: {
      const winner = msg.player > 1 ? null : view.player(msg.player);
      const reason = ctx.victoryReason(msg.reason);
      state.winner = { winner, reason };
      return [{ kind: 'WIN', winner, reason }];
    }
    default:
      return [];
  }
}
