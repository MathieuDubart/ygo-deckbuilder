import { OcgLocation, OcgMessageType, OcgPosition, type OcgMessage } from 'ocgcore-wasm';
import { describe, expect, it } from 'vitest';
import { applyMessage, newTracker } from './events';
import { DuelView } from './view';

const ctx = {
  view: new DuelView(0),
  describe: (d: bigint | number) => (BigInt(d) === 500n ? 'Select a card' : null),
  hidden: (c: { controller: number; location: number; position?: number }) =>
    c.controller === 1 &&
    (c.location === OcgLocation.HAND || c.position === OcgPosition.FACEDOWN_DEFENSE),
  cardName: (code: number) => (code === 89631139 ? 'Blue-Eyes White Dragon' : null),
  victoryReason: () => 'LP reached 0',
  codeAt: () => 89631139,
};
const m = (x: object) => x as unknown as OcgMessage;

describe('applyMessage', () => {
  it('suit tours, phases et points de vie', () => {
    const state = newTracker(8000);
    expect(applyMessage(m({ type: OcgMessageType.NEW_TURN, player: 1 }), state, ctx)).toEqual([
      { kind: 'TURN', player: 1 },
    ]);
    applyMessage(m({ type: OcgMessageType.NEW_PHASE, phase: 0x04 }), state, ctx);
    expect(state.phase).toBe('MAIN1');
    applyMessage(m({ type: OcgMessageType.DAMAGE, player: 0, amount: 3000 }), state, ctx);
    applyMessage(m({ type: OcgMessageType.PAY_LPCOST, player: 0, amount: 6000 }), state, ctx);
    applyMessage(m({ type: OcgMessageType.RECOVER, player: 1, amount: 500 }), state, ctx);
    expect(state.lp).toEqual([0, 8500]);
    expect(state.turn).toBe(1);
    expect(state.turnPlayer).toBe(1);
  });

  it("ne montre pas ce que pioche l'adversaire", () => {
    const drawn = [{ code: 1, position: 0 }];
    expect(
      applyMessage(m({ type: OcgMessageType.DRAW, player: 1, drawn }), newTracker(8000), ctx),
    ).toEqual([{ kind: 'DRAW', player: 1, count: 1, codes: [] }]);
    expect(
      applyMessage(m({ type: OcgMessageType.DRAW, player: 0, drawn }), newTracker(8000), ctx),
    ).toEqual([{ kind: 'DRAW', player: 0, count: 1, codes: [1] }]);
  });

  it('empile puis résout la chaîne', () => {
    const state = newTracker(8000);
    const chaining = (size: number) =>
      m({
        type: OcgMessageType.CHAINING,
        code: 10 + size,
        controller: 0,
        location: OcgLocation.HAND,
        sequence: 0,
        description: 500n,
        chain_size: size,
      });
    applyMessage(chaining(1), state, ctx);
    applyMessage(chaining(2), state, ctx);
    expect(state.chain.map((c) => c.card.code)).toEqual([11, 12]);
    applyMessage(m({ type: OcgMessageType.CHAIN_SOLVED, chain_size: 2 }), state, ctx);
    expect(state.chain).toHaveLength(1);
    applyMessage(m({ type: OcgMessageType.CHAIN_END }), state, ctx);
    expect(state.chain).toEqual([]);
  });

  it('ne journalise que les mouvements qui ont du sens', () => {
    const move = (from: number, to: number, position = OcgPosition.FACEUP_ATTACK) =>
      applyMessage(
        m({
          type: OcgMessageType.MOVE,
          card: 42,
          from: { controller: 1, location: from, sequence: 0, position },
          to: { controller: 1, location: to, sequence: 0, position },
        }),
        newTracker(8000),
        ctx,
      );
    expect(move(OcgLocation.DECK, OcgLocation.HAND)).toEqual([]);
    expect(move(OcgLocation.HAND, OcgLocation.MZONE)).toEqual([]);
    expect(move(OcgLocation.MZONE, OcgLocation.GRAVE)).toEqual([
      { kind: 'MOVE', player: 1, code: 42, from: 'MZONE', to: 'GRAVE' },
    ]);
    expect(move(OcgLocation.HAND, OcgLocation.DECK)).toEqual([
      { kind: 'MOVE', player: 1, code: 0, from: 'HAND', to: 'DECK' },
    ]);
  });

  it("retient l'indice de sélection et le vainqueur", () => {
    const state = newTracker(8000);
    applyMessage(m({ type: OcgMessageType.HINT, hint_type: 3, player: 0, hint: 500n }), state, ctx);
    expect(state.hint).toBe('Select a card');
    applyMessage(
      m({ type: OcgMessageType.HINT, hint_type: 3, player: 0, hint: 89631139n }),
      state,
      ctx,
    );
    expect(state.hint).toBe('Blue-Eyes White Dragon');
    expect(applyMessage(m({ type: OcgMessageType.WIN, player: 1, reason: 1 }), state, ctx)).toEqual(
      [{ kind: 'WIN', winner: 1, reason: 'LP reached 0' }],
    );
  });
});
