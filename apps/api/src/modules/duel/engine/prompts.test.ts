import {
  OcgLocation,
  OcgMessageType,
  OcgPosition,
  OcgResponseType,
  SelectIdleCMDAction,
} from 'ocgcore-wasm';
import { describe, expect, it } from 'vitest';
import {
  autoResponse,
  greedySum,
  InvalidResponseError,
  isTrivial,
  toPrompt,
  toResponse,
  type SelectMessage,
} from './prompts';
import { DuelView } from './view';

const view = new DuelView(1); // l'utilisateur joue en second : équipe 1 du moteur
const ctx = {
  id: 7,
  view,
  describe: (d: bigint | number) => (BigInt(d) === 1160n ? 'Activate' : null),
  hint: 'Select',
  hidden: (c: { controller: number; location: number }) =>
    c.controller === 0 && c.location === OcgLocation.HAND,
};
const card = (code: number, controller = 1, location = OcgLocation.HAND, sequence = 0) => ({
  code,
  controller,
  location,
  sequence,
});
const msg = (m: object) => m as unknown as SelectMessage;

const idle = msg({
  type: OcgMessageType.SELECT_IDLECMD,
  player: 1,
  summons: [card(10)],
  special_summons: [],
  pos_changes: [],
  monster_sets: [card(10), card(11)],
  spell_sets: [],
  activates: [{ ...card(12), description: 1160n, client_mode: 0 }],
  to_bp: true,
  to_ep: true,
  shuffle: false,
});

describe('toPrompt', () => {
  it('transforme les commandes de Main Phase en actions indexées', () => {
    const prompt = toPrompt(idle, ctx);
    expect(prompt).toMatchObject({ id: 7, player: 0, kind: 'IDLE', canBattle: true });
    if (prompt?.kind !== 'IDLE') throw new Error();
    expect(prompt.actions.map((a) => `${a.kind}:${a.index}:${a.card.code}`)).toEqual([
      'SUMMON:0:10',
      'SET_MONSTER:0:10',
      'SET_MONSTER:1:11',
      'ACTIVATE:0:12',
    ]);
    expect(prompt.actions[3]!.description).toBe('Activate');
  });

  it("cache les cartes en main de l'adversaire", () => {
    const prompt = toPrompt(
      msg({
        type: OcgMessageType.SELECT_CARD,
        player: 1,
        can_cancel: false,
        min: 1,
        max: 1,
        selects: [card(99, 0, OcgLocation.HAND), card(98, 0, OcgLocation.MZONE)],
      }),
      ctx,
    );
    if (prompt?.kind !== 'SELECT_CARDS') throw new Error();
    expect(prompt.cards.map((c) => [c.card.controller, c.card.code])).toEqual([
      [1, 0],
      [1, 98],
    ]);
  });

  it('présente les zones libres du point de vue de celui qui choisit', () => {
    const mask = ~(1 << 3) >>> 0;
    const prompt = toPrompt(
      msg({ type: OcgMessageType.SELECT_PLACE, player: 1, count: 1, field_mask: mask }),
      ctx,
    );
    expect(prompt).toMatchObject({
      kind: 'PLACE',
      zones: [{ controller: 0, location: 'MZONE', sequence: 3 }],
    });
  });
});

describe('toResponse', () => {
  it('traduit une action et un changement de phase', () => {
    expect(toResponse(idle, { promptId: 7, action: { kind: 'ACTIVATE', index: 0 } }, view)).toEqual(
      {
        type: OcgResponseType.SELECT_IDLECMD,
        action: SelectIdleCMDAction.SELECT_ACTIVATE,
        index: 0,
      },
    );
    expect(toResponse(idle, { promptId: 7, phase: 'END' }, view)).toMatchObject({
      action: SelectIdleCMDAction.TO_EP,
    });
  });

  it('refuse un index hors liste ou une attaque en Main Phase', () => {
    expect(() =>
      toResponse(idle, { promptId: 7, action: { kind: 'SUMMON', index: 1 } }, view),
    ).toThrow(InvalidResponseError);
    expect(() =>
      toResponse(idle, { promptId: 7, action: { kind: 'ATTACK', index: 0 } }, view),
    ).toThrow(InvalidResponseError);
  });

  it('remet la zone choisie dans le repère du moteur', () => {
    const place = msg({
      type: OcgMessageType.SELECT_PLACE,
      player: 1,
      count: 1,
      field_mask: ~(1 << 3) >>> 0,
    });
    expect(
      toResponse(
        place,
        { promptId: 7, zones: [{ controller: 0, location: 'MZONE', sequence: 3 }] },
        view,
      ),
    ).toEqual({
      type: OcgResponseType.SELECT_PLACE,
      places: [{ player: 1, location: OcgLocation.MZONE, sequence: 3 }],
    });
    expect(() =>
      toResponse(
        place,
        { promptId: 7, zones: [{ controller: 0, location: 'MZONE', sequence: 2 }] },
        view,
      ),
    ).toThrow(InvalidResponseError);
  });

  it('respecte le nombre de cartes demandé', () => {
    const select = msg({
      type: OcgMessageType.SELECT_CARD,
      player: 1,
      can_cancel: false,
      min: 2,
      max: 2,
      selects: [card(1), card(2), card(3)],
    });
    expect(() => toResponse(select, { promptId: 7, indices: [0] }, view)).toThrow();
    expect(() => toResponse(select, { promptId: 7, indices: [0, 0] }, view)).toThrow();
    expect(() => toResponse(select, { promptId: 7, indices: null }, view)).toThrow();
    expect(toResponse(select, { promptId: 7, indices: [2, 0] }, view)).toEqual({
      type: OcgResponseType.SELECT_CARD,
      indicies: [2, 0],
    });
  });

  it('refuse une position non proposée', () => {
    const position = msg({
      type: OcgMessageType.SELECT_POSITION,
      player: 1,
      code: 1,
      positions: OcgPosition.FACEUP_ATTACK | OcgPosition.FACEUP_DEFENSE,
    });
    expect(() => toResponse(position, { promptId: 7, position: 'FD_DEF' }, view)).toThrow();
    expect(toResponse(position, { promptId: 7, position: 'DEF' }, view)).toMatchObject({
      position: OcgPosition.FACEUP_DEFENSE,
    });
  });
});

describe('adversaire passif', () => {
  it('passe son tour et ne déclenche rien', () => {
    expect(autoResponse(idle)).toMatchObject({ action: SelectIdleCMDAction.TO_EP });
    expect(
      autoResponse(msg({ type: OcgMessageType.SELECT_CHAIN, forced: false, selects: [card(1)] })),
    ).toEqual({ type: OcgResponseType.SELECT_CHAIN, index: null });
    expect(
      autoResponse(msg({ type: OcgMessageType.SELECT_EFFECTYN, player: 0, description: 0n })),
    ).toMatchObject({ yes: false });
  });

  it('choisit la première zone libre', () => {
    expect(
      autoResponse(
        msg({
          type: OcgMessageType.SELECT_PLACE,
          player: 0,
          count: 1,
          field_mask: ~(1 << 9) >>> 0,
        }),
      ),
    ).toEqual({
      type: OcgResponseType.SELECT_PLACE,
      places: [{ player: 0, location: OcgLocation.SZONE, sequence: 1 }],
    });
  });

  it("ne dérange pas l'utilisateur pour une chaîne vide ou une seule position", () => {
    expect(isTrivial(msg({ type: OcgMessageType.SELECT_CHAIN, forced: false, selects: [] }))).toBe(
      true,
    );
    expect(
      isTrivial(
        msg({ type: OcgMessageType.SELECT_POSITION, positions: OcgPosition.FACEUP_ATTACK }),
      ),
    ).toBe(true);
    expect(isTrivial(idle)).toBe(false);
  });
});

describe('greedySum', () => {
  it('prend les premières valeurs qui atteignent la somme (Niveau bas)', () => {
    expect(greedySum([4, (6 << 16) | 3, 5], 7)).toEqual([0, 1]);
  });
});
