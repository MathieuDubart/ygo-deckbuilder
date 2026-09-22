import {
  OcgAttribute,
  OcgLocation,
  OcgMessageType,
  OcgPosition,
  OcgRace,
  OcgResponseType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type OcgMessage,
  type OcgResponse,
} from 'ocgcore-wasm';
import type { DuelActionDto, DuelChoiceCard, DuelPromptDto, DuelResponseInput } from '@ygo/shared';
import { fromPosition, positionsIn, zonesFromMask, type DuelView } from './view';

/** Message du moteur qui attend une réponse d'un joueur. */
export type SelectMessage = Extract<
  OcgMessage,
  {
    type:
      | OcgMessageType.SELECT_IDLECMD
      | OcgMessageType.SELECT_BATTLECMD
      | OcgMessageType.SELECT_CHAIN
      | OcgMessageType.SELECT_EFFECTYN
      | OcgMessageType.SELECT_YESNO
      | OcgMessageType.SELECT_OPTION
      | OcgMessageType.SELECT_CARD
      | OcgMessageType.SELECT_TRIBUTE
      | OcgMessageType.SELECT_SUM
      | OcgMessageType.SELECT_UNSELECT_CARD
      | OcgMessageType.SELECT_PLACE
      | OcgMessageType.SELECT_DISFIELD
      | OcgMessageType.SELECT_POSITION
      | OcgMessageType.SELECT_COUNTER
      | OcgMessageType.SORT_CARD
      | OcgMessageType.SORT_CHAIN
      | OcgMessageType.ANNOUNCE_RACE
      | OcgMessageType.ANNOUNCE_ATTRIB
      | OcgMessageType.ANNOUNCE_CARD
      | OcgMessageType.ANNOUNCE_NUMBER
      | OcgMessageType.ROCK_PAPER_SCISSORS;
  }
>;

const SELECT_TYPES = new Set<number>([
  OcgMessageType.SELECT_IDLECMD,
  OcgMessageType.SELECT_BATTLECMD,
  OcgMessageType.SELECT_CHAIN,
  OcgMessageType.SELECT_EFFECTYN,
  OcgMessageType.SELECT_YESNO,
  OcgMessageType.SELECT_OPTION,
  OcgMessageType.SELECT_CARD,
  OcgMessageType.SELECT_TRIBUTE,
  OcgMessageType.SELECT_SUM,
  OcgMessageType.SELECT_UNSELECT_CARD,
  OcgMessageType.SELECT_PLACE,
  OcgMessageType.SELECT_DISFIELD,
  OcgMessageType.SELECT_POSITION,
  OcgMessageType.SELECT_COUNTER,
  OcgMessageType.SORT_CARD,
  OcgMessageType.SORT_CHAIN,
  OcgMessageType.ANNOUNCE_RACE,
  OcgMessageType.ANNOUNCE_ATTRIB,
  OcgMessageType.ANNOUNCE_CARD,
  OcgMessageType.ANNOUNCE_NUMBER,
  OcgMessageType.ROCK_PAPER_SCISSORS,
]);

export function isSelectMessage(m: OcgMessage): m is SelectMessage {
  return SELECT_TYPES.has(m.type);
}

/** Textes des descriptions d'effets (`code << 20 | index`) et des textes système. */
export type Describe = (description: bigint | number) => string | null;

/** Cartes cachées pour l'utilisateur (main / cartes face verso adverses, sauf s'il contrôle l'adversaire). */
export type IsHidden = (card: {
  controller: number;
  location: number;
  position?: number;
}) => boolean;

const RACE_ENTRIES = Object.entries(OcgRace).filter(([, v]) => typeof v === 'bigint') as [
  string,
  bigint,
][];
const ATTRIBUTE_ENTRIES = Object.entries(OcgAttribute).filter(([, v]) => typeof v === 'number') as [
  string,
  number,
][];

/**
 * Message de choix du moteur → invite pour le client (point de vue de l'utilisateur).
 * `id` sert à rejeter une réponse à une invite périmée.
 */
export function toPrompt(
  msg: SelectMessage,
  ctx: { id: number; view: DuelView; describe: Describe; hint: string | null; hidden: IsHidden },
): DuelPromptDto | null {
  const { view, describe } = ctx;
  const base = { id: ctx.id, player: view.player(msg.player), hint: ctx.hint };
  const ref = (c: {
    code: number;
    controller: number;
    location: number;
    sequence: number;
    position?: number;
  }) => view.ref(c, ctx.hidden(c));
  const choice = (
    c: { code: number; controller: number; location: number; sequence: number; position?: number },
    index: number,
    extra: Partial<DuelChoiceCard> = {},
  ): DuelChoiceCard => ({ index, card: ref(c), ...extra });

  switch (msg.type) {
    case OcgMessageType.SELECT_IDLECMD: {
      const actions: DuelActionDto[] = [
        ...msg.summons.map((c, index) => ({
          kind: 'SUMMON' as const,
          index,
          card: ref(c),
          description: null,
        })),
        ...msg.special_summons.map((c, index) => ({
          kind: 'SPSUMMON' as const,
          index,
          card: ref(c),
          description: null,
        })),
        ...msg.pos_changes.map((c, index) => ({
          kind: 'REPOSITION' as const,
          index,
          card: ref(c),
          description: null,
        })),
        ...msg.monster_sets.map((c, index) => ({
          kind: 'SET_MONSTER' as const,
          index,
          card: ref(c),
          description: null,
        })),
        ...msg.spell_sets.map((c, index) => ({
          kind: 'SET_SPELL' as const,
          index,
          card: ref(c),
          description: null,
        })),
        ...msg.activates.map((c, index) => ({
          kind: 'ACTIVATE' as const,
          index,
          card: ref(c),
          description: describe(c.description),
        })),
      ];
      return { ...base, kind: 'IDLE', actions, canBattle: msg.to_bp, canEnd: msg.to_ep };
    }
    case OcgMessageType.SELECT_BATTLECMD: {
      const actions: DuelActionDto[] = [
        ...msg.chains.map((c, index) => ({
          kind: 'ACTIVATE' as const,
          index,
          card: ref(c),
          description: describe(c.description),
        })),
        ...msg.attacks.map((c, index) => ({
          kind: 'ATTACK' as const,
          index,
          card: ref(c),
          description: null,
          direct: c.can_direct,
        })),
      ];
      return { ...base, kind: 'BATTLE', actions, canMain2: msg.to_m2, canEnd: msg.to_ep };
    }
    case OcgMessageType.SELECT_CHAIN:
      return {
        ...base,
        kind: 'CHAIN',
        forced: msg.forced,
        options: msg.selects.map((c, i) => choice(c, i, { description: describe(c.description) })),
      };
    case OcgMessageType.SELECT_EFFECTYN:
      return {
        ...base,
        kind: 'YESNO',
        text: describe(msg.description) ?? '',
        card: ref(msg),
      };
    case OcgMessageType.SELECT_YESNO:
      return { ...base, kind: 'YESNO', text: describe(msg.description) ?? '', card: null };
    case OcgMessageType.SELECT_OPTION:
      return {
        ...base,
        kind: 'OPTION',
        options: msg.options.map((o, index) => ({ index, text: describe(o) ?? `#${index + 1}` })),
      };
    case OcgMessageType.SELECT_CARD:
      return {
        ...base,
        kind: 'SELECT_CARDS',
        mode: 'CARD',
        cards: msg.selects.map((c, i) => choice(c, i)),
        mustCards: [],
        min: msg.min,
        max: msg.max,
        sum: null,
        cancelable: msg.can_cancel,
      };
    case OcgMessageType.SELECT_TRIBUTE:
      return {
        ...base,
        kind: 'SELECT_CARDS',
        mode: 'TRIBUTE',
        cards: msg.selects.map((c, i) => choice(c, i, { value: c.release_param })),
        mustCards: [],
        min: msg.min,
        max: msg.max,
        sum: null,
        cancelable: msg.can_cancel,
      };
    case OcgMessageType.SELECT_SUM:
      return {
        ...base,
        kind: 'SELECT_CARDS',
        mode: 'SUM',
        cards: msg.selects.map((c, i) => choice(c, i, { value: c.amount })),
        mustCards: msg.selects_must.map((c, i) => choice(c, i, { value: c.amount })),
        min: msg.min,
        max: msg.max,
        sum: msg.amount,
        cancelable: false,
      };
    case OcgMessageType.SELECT_UNSELECT_CARD:
      return {
        ...base,
        kind: 'SELECT_UNSELECT',
        selectable: msg.select_cards.map((c, i) => choice(c, i)),
        unselectable: msg.unselect_cards.map((c, i) => choice(c, msg.select_cards.length + i)),
        canFinish: msg.can_finish,
        cancelable: msg.can_cancel,
        min: msg.min,
        max: msg.max,
      };
    case OcgMessageType.SELECT_PLACE:
    case OcgMessageType.SELECT_DISFIELD:
      return {
        ...base,
        kind: 'PLACE',
        count: msg.count,
        disable: msg.type === OcgMessageType.SELECT_DISFIELD,
        zones: zonesFromMask(msg.field_mask, base.player),
      };
    case OcgMessageType.SELECT_POSITION:
      return { ...base, kind: 'POSITION', code: msg.code, positions: positionsIn(msg.positions) };
    case OcgMessageType.ANNOUNCE_NUMBER:
      return { ...base, kind: 'ANNOUNCE_NUMBER', values: msg.options.map((o) => Number(o)) };
    case OcgMessageType.ANNOUNCE_RACE:
      return {
        ...base,
        kind: 'ANNOUNCE_RACE',
        count: msg.count,
        choices: RACE_ENTRIES.filter(([, v]) => (BigInt(msg.available) & v) !== 0n).map(([k]) => k),
      };
    case OcgMessageType.ANNOUNCE_ATTRIB:
      return {
        ...base,
        kind: 'ANNOUNCE_ATTRIBUTE',
        count: msg.count,
        choices: ATTRIBUTE_ENTRIES.filter(([, v]) => (msg.available & v) !== 0).map(([k]) => k),
      };
    case OcgMessageType.ANNOUNCE_CARD:
      return { ...base, kind: 'ANNOUNCE_CARD' };
    case OcgMessageType.SORT_CARD:
    case OcgMessageType.SORT_CHAIN:
      return { ...base, kind: 'SORT', cards: msg.cards.map((c, i) => choice(c, i)) };
    default:
      // Compteurs, pierre-feuille-ciseaux : répondus automatiquement
      return null;
  }
}

export class InvalidResponseError extends Error {}

/** Réponse du client → réponse du moteur. Lève InvalidResponseError si elle ne colle pas. */
export function toResponse(
  msg: SelectMessage,
  input: DuelResponseInput,
  view: DuelView,
): OcgResponse {
  const fail = (why: string): never => {
    throw new InvalidResponseError(why);
  };
  switch (msg.type) {
    case OcgMessageType.SELECT_IDLECMD: {
      if (input.phase === 'BATTLE' && msg.to_bp)
        return {
          type: OcgResponseType.SELECT_IDLECMD,
          action: SelectIdleCMDAction.TO_BP,
          index: null,
        };
      if (input.phase === 'END' && msg.to_ep)
        return {
          type: OcgResponseType.SELECT_IDLECMD,
          action: SelectIdleCMDAction.TO_EP,
          index: null,
        };
      const a = input.action ?? fail('action');
      const lists = {
        SUMMON: [SelectIdleCMDAction.SELECT_SUMMON, msg.summons.length],
        SPSUMMON: [SelectIdleCMDAction.SELECT_SPECIAL_SUMMON, msg.special_summons.length],
        REPOSITION: [SelectIdleCMDAction.SELECT_POS_CHANGE, msg.pos_changes.length],
        SET_MONSTER: [SelectIdleCMDAction.SELECT_MONSTER_SET, msg.monster_sets.length],
        SET_SPELL: [SelectIdleCMDAction.SELECT_SPELL_SET, msg.spell_sets.length],
        ACTIVATE: [SelectIdleCMDAction.SELECT_ACTIVATE, msg.activates.length],
      } as const;
      if (a.kind === 'ATTACK') fail('action');
      const [action, length] = lists[a.kind as keyof typeof lists];
      if (a.index >= length) fail('index');
      return { type: OcgResponseType.SELECT_IDLECMD, action, index: a.index };
    }
    case OcgMessageType.SELECT_BATTLECMD: {
      if (input.phase === 'MAIN2' && msg.to_m2)
        return {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.TO_M2,
          index: null,
        };
      if (input.phase === 'END' && msg.to_ep)
        return {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.TO_EP,
          index: null,
        };
      const a = input.action ?? fail('action');
      if (a.kind === 'ACTIVATE' && a.index < msg.chains.length)
        return {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.SELECT_CHAIN,
          index: a.index,
        };
      if (a.kind === 'ATTACK' && a.index < msg.attacks.length)
        return {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.SELECT_BATTLE,
          index: a.index,
        };
      return fail('action');
    }
    case OcgMessageType.SELECT_CHAIN: {
      const index = input.index ?? null;
      if (index === null && msg.forced) fail('forced');
      if (index !== null && index >= msg.selects.length) fail('index');
      return { type: OcgResponseType.SELECT_CHAIN, index };
    }
    case OcgMessageType.SELECT_EFFECTYN:
      return { type: OcgResponseType.SELECT_EFFECTYN, yes: input.yes ?? fail('yes') };
    case OcgMessageType.SELECT_YESNO:
      return { type: OcgResponseType.SELECT_YESNO, yes: input.yes ?? fail('yes') };
    case OcgMessageType.SELECT_OPTION: {
      const index = input.index ?? fail('index');
      if (index >= msg.options.length) fail('index');
      return { type: OcgResponseType.SELECT_OPTION, index };
    }
    case OcgMessageType.SELECT_CARD:
    case OcgMessageType.SELECT_TRIBUTE: {
      const indices = input.indices ?? null;
      if (indices === null) {
        if (!msg.can_cancel) fail('cancel');
      } else {
        if (
          new Set(indices).size !== indices.length ||
          indices.some((i) => i >= msg.selects.length)
        )
          fail('index');
        if (
          msg.type === OcgMessageType.SELECT_CARD &&
          (indices.length < msg.min || indices.length > msg.max)
        )
          fail('count');
      }
      return msg.type === OcgMessageType.SELECT_CARD
        ? { type: OcgResponseType.SELECT_CARD, indicies: indices }
        : { type: OcgResponseType.SELECT_TRIBUTE, indicies: indices };
    }
    case OcgMessageType.SELECT_SUM: {
      const indices = input.indices ?? fail('indices');
      if (indices.some((i) => i >= msg.selects.length)) fail('index');
      return { type: OcgResponseType.SELECT_SUM, indicies: indices };
    }
    case OcgMessageType.SELECT_UNSELECT_CARD: {
      const index = input.index ?? null;
      if (index === null && !msg.can_finish && !msg.can_cancel) fail('finish');
      if (index !== null && index >= msg.select_cards.length + msg.unselect_cards.length)
        fail('index');
      return { type: OcgResponseType.SELECT_UNSELECT_CARD, index };
    }
    case OcgMessageType.SELECT_PLACE:
    case OcgMessageType.SELECT_DISFIELD: {
      const chooser = view.player(msg.player);
      const allowed = zonesFromMask(msg.field_mask, chooser);
      const zones = input.zones ?? fail('zones');
      if (zones.length !== msg.count) fail('count');
      const places = zones.map((z) => {
        if (
          !allowed.some(
            (a) =>
              a.controller === z.controller &&
              a.location === z.location &&
              a.sequence === z.sequence,
          )
        )
          fail('zone');
        return {
          player: view.team(z.controller),
          location: z.location === 'MZONE' ? OcgLocation.MZONE : OcgLocation.SZONE,
          sequence: z.sequence,
        };
      });
      return msg.type === OcgMessageType.SELECT_PLACE
        ? { type: OcgResponseType.SELECT_PLACE, places }
        : { type: OcgResponseType.SELECT_DISFIELD, places };
    }
    case OcgMessageType.SELECT_POSITION: {
      const position = fromPosition(input.position ?? fail('position'));
      if (!(msg.positions & position)) fail('position');
      return { type: OcgResponseType.SELECT_POSITION, position: position as OcgPosition };
    }
    case OcgMessageType.ANNOUNCE_NUMBER: {
      const index = input.index ?? fail('index');
      if (index >= msg.options.length) fail('index');
      return { type: OcgResponseType.ANNOUNCE_NUMBER, value: index };
    }
    case OcgMessageType.ANNOUNCE_RACE: {
      const races = (input.values ?? fail('values')).map(
        (v) => RACE_ENTRIES.find(([k]) => k === v)?.[1] ?? fail('race'),
      );
      if (races.length !== msg.count) fail('count');
      return { type: OcgResponseType.ANNOUNCE_RACE, races: races as OcgRace[] };
    }
    case OcgMessageType.ANNOUNCE_ATTRIB: {
      const attributes = (input.values ?? fail('values')).map(
        (v) => ATTRIBUTE_ENTRIES.find(([k]) => k === v)?.[1] ?? fail('attribute'),
      );
      if (attributes.length !== msg.count) fail('count');
      return { type: OcgResponseType.ANNOUNCE_ATTRIB, attributes: attributes as OcgAttribute[] };
    }
    case OcgMessageType.ANNOUNCE_CARD:
      return { type: OcgResponseType.ANNOUNCE_CARD, card: input.cardId ?? fail('cardId') };
    case OcgMessageType.SORT_CARD:
    case OcgMessageType.SORT_CHAIN: {
      const order = input.order ?? null;
      if (order && (order.length !== msg.cards.length || new Set(order).size !== order.length))
        fail('order');
      return { type: OcgResponseType.SORT_CARD, order };
    }
    default:
      return autoResponse(msg);
  }
}

/**
 * Réponse automatique d'un joueur qui ne fait rien (adversaire passif) : il passe, refuse les
 * effets optionnels, choisit le minimum et la première option quand il est obligé de choisir.
 */
export function autoResponse(msg: SelectMessage): OcgResponse {
  switch (msg.type) {
    case OcgMessageType.SELECT_IDLECMD:
      return msg.to_ep
        ? { type: OcgResponseType.SELECT_IDLECMD, action: SelectIdleCMDAction.TO_EP, index: null }
        : { type: OcgResponseType.SELECT_IDLECMD, action: SelectIdleCMDAction.TO_BP, index: null };
    case OcgMessageType.SELECT_BATTLECMD:
      return msg.to_ep
        ? {
            type: OcgResponseType.SELECT_BATTLECMD,
            action: SelectBattleCMDAction.TO_EP,
            index: null,
          }
        : {
            type: OcgResponseType.SELECT_BATTLECMD,
            action: SelectBattleCMDAction.TO_M2,
            index: null,
          };
    case OcgMessageType.SELECT_CHAIN:
      return { type: OcgResponseType.SELECT_CHAIN, index: msg.forced ? 0 : null };
    case OcgMessageType.SELECT_EFFECTYN:
      return { type: OcgResponseType.SELECT_EFFECTYN, yes: false };
    case OcgMessageType.SELECT_YESNO:
      return { type: OcgResponseType.SELECT_YESNO, yes: false };
    case OcgMessageType.SELECT_OPTION:
      return { type: OcgResponseType.SELECT_OPTION, index: 0 };
    case OcgMessageType.SELECT_CARD:
      return { type: OcgResponseType.SELECT_CARD, indicies: range(Math.max(1, msg.min)) };
    case OcgMessageType.SELECT_TRIBUTE:
      return { type: OcgResponseType.SELECT_TRIBUTE, indicies: range(Math.max(1, msg.min)) };
    case OcgMessageType.SELECT_SUM:
      return {
        type: OcgResponseType.SELECT_SUM,
        indicies: greedySum(
          msg.selects.map((s) => s.amount),
          msg.amount,
        ),
      };
    case OcgMessageType.SELECT_UNSELECT_CARD:
      return {
        type: OcgResponseType.SELECT_UNSELECT_CARD,
        index: msg.can_finish || msg.select_cards.length === 0 ? null : 0,
      };
    case OcgMessageType.SELECT_PLACE:
    case OcgMessageType.SELECT_DISFIELD: {
      const places: { player: number; location: OcgLocation; sequence: number }[] = [];
      for (let bit = 0; bit < 32 && places.length < msg.count; bit++) {
        if (msg.field_mask & (1 << bit)) continue;
        const own = bit < 16;
        const b = bit % 16;
        places.push({
          player: own ? msg.player : 1 - msg.player,
          location: b < 8 ? OcgLocation.MZONE : OcgLocation.SZONE,
          sequence: b % 8,
        });
      }
      return msg.type === OcgMessageType.SELECT_PLACE
        ? { type: OcgResponseType.SELECT_PLACE, places }
        : { type: OcgResponseType.SELECT_DISFIELD, places };
    }
    case OcgMessageType.SELECT_POSITION: {
      const order = [
        OcgPosition.FACEUP_ATTACK,
        OcgPosition.FACEUP_DEFENSE,
        OcgPosition.FACEDOWN_DEFENSE,
        OcgPosition.FACEDOWN_ATTACK,
      ];
      return {
        type: OcgResponseType.SELECT_POSITION,
        position: (order.find((p) => msg.positions & p) ??
          OcgPosition.FACEUP_ATTACK) as OcgPosition,
      };
    }
    case OcgMessageType.SELECT_COUNTER: {
      // Retire les compteurs demandés, carte par carte
      let left = msg.count;
      const counters = msg.cards.map((c) => {
        const take = Math.min(c.count, left);
        left -= take;
        return take;
      });
      return { type: OcgResponseType.SELECT_COUNTER, counters };
    }
    case OcgMessageType.SORT_CARD:
    case OcgMessageType.SORT_CHAIN:
      return { type: OcgResponseType.SORT_CARD, order: null };
    case OcgMessageType.ANNOUNCE_RACE: {
      const races = RACE_ENTRIES.filter(([, v]) => (BigInt(msg.available) & v) !== 0n)
        .slice(0, msg.count)
        .map(([, v]) => v);
      return { type: OcgResponseType.ANNOUNCE_RACE, races: races as OcgRace[] };
    }
    case OcgMessageType.ANNOUNCE_ATTRIB: {
      const attributes = ATTRIBUTE_ENTRIES.filter(([, v]) => (msg.available & v) !== 0)
        .slice(0, msg.count)
        .map(([, v]) => v);
      return { type: OcgResponseType.ANNOUNCE_ATTRIB, attributes: attributes as OcgAttribute[] };
    }
    case OcgMessageType.ANNOUNCE_NUMBER:
      return { type: OcgResponseType.ANNOUNCE_NUMBER, value: 0 };
    case OcgMessageType.ANNOUNCE_CARD:
      // Rarement utilisé par un joueur passif : un nom au hasard n'a pas de sens, on annonce 0
      return { type: OcgResponseType.ANNOUNCE_CARD, card: 0 };
    case OcgMessageType.ROCK_PAPER_SCISSORS:
      return {
        type: OcgResponseType.ROCK_PAPER_SCISSORS,
        value: (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3,
      };
  }
}

/** Choix que le moteur pose sans que la décision compte : on ne dérange pas l'utilisateur. */
export function isTrivial(msg: SelectMessage): boolean {
  switch (msg.type) {
    case OcgMessageType.SELECT_CHAIN:
      // Rien à enchaîner : EDOPro passe tout seul
      return msg.selects.length === 0 && !msg.forced;
    case OcgMessageType.SELECT_COUNTER:
    case OcgMessageType.ROCK_PAPER_SCISSORS:
      return true;
    case OcgMessageType.SELECT_POSITION:
      // Une seule position possible
      return positionsIn(msg.positions).length === 1;
    default:
      return false;
  }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Premières valeurs dont la somme atteint le total (Niveaux des cartes, etc.). */
export function greedySum(values: number[], target: number): number[] {
  const picked: number[] = [];
  let total = 0;
  for (let i = 0; i < values.length && total < target; i++) {
    // Les valeurs peuvent encoder deux Niveaux (16 bits bas / hauts) : on prend le bas
    total += values[i]! & 0xffff;
    picked.push(i);
  }
  return picked;
}
