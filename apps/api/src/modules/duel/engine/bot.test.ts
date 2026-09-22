import {
  OcgLocation,
  OcgMessageType,
  OcgPosition,
  OcgResponseType,
  OcgType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type OcgCardData,
  type OcgMessage,
} from 'ocgcore-wasm';
import { describe, expect, it } from 'vitest';
import { beats, DuelBot, findSum, type BotMonster, type BotWorld } from './bot';
import type { SelectMessage } from './prompts';

const BOT = 1;
const data = (code: number, type: number, attack = 0, defense = 0, level = 4): OcgCardData => ({
  code,
  alias: 0,
  setcodes: [],
  type,
  level,
  attribute: 0,
  race: 0n,
  attack,
  defense,
  lscale: 0,
  rscale: 0,
  link_marker: 0,
});
const CARDS = new Map<number, OcgCardData>([
  [1, data(1, OcgType.MONSTER | OcgType.NORMAL, 1800, 1000)],
  [2, data(2, OcgType.MONSTER | OcgType.NORMAL, 1000, 2000)],
  [3, data(3, OcgType.SPELL | OcgType.FIELD)],
  [4, data(4, OcgType.SPELL)],
  [5, data(5, OcgType.TRAP)],
  [6, data(6, OcgType.MONSTER | OcgType.EFFECT, 0, 1800)], // hand trap
]);

const mon = (
  code: number,
  sequence: number,
  attack: number,
  defense = 0,
  known = true,
): BotMonster => ({
  code,
  sequence,
  position: OcgPosition.FACEUP_ATTACK,
  attack,
  defense,
  known,
});
function world(
  over: Partial<BotWorld> & { mine?: BotMonster[]; theirs?: BotMonster[] } = {},
): BotWorld {
  const { mine = [], theirs = [], ...rest } = over;
  return {
    team: BOT,
    turnPlayer: BOT,
    phase: 'MAIN1',
    hintCode: null,
    info: (code) => CARDS.get(code) ?? null,
    monsters: (t) => (t === BOT ? mine : theirs),
    knownOpponentCodes: () => [],
    ...rest,
  };
}
const card = (code: number, location: number, controller = BOT, sequence = 0) => ({
  code,
  controller: controller as 0 | 1,
  location,
  sequence,
});
const msg = (m: object) => m as unknown as SelectMessage;
const idle = (over: object = {}) =>
  msg({
    type: OcgMessageType.SELECT_IDLECMD,
    player: BOT,
    summons: [],
    special_summons: [],
    pos_changes: [],
    monster_sets: [],
    spell_sets: [],
    activates: [],
    to_bp: true,
    to_ep: true,
    shuffle: false,
    ...over,
  });
const active = (code: number, location: number) => ({
  ...card(code, location),
  description: BigInt(code << 20),
  client_mode: 0,
});

describe('DuelBot — Main Phase', () => {
  it('active sa Magie Terrain avant le reste et garde ses Pièges', () => {
    const bot = new DuelBot();
    const r = bot.respond(
      idle({
        activates: [
          active(5, OcgLocation.SZONE),
          active(4, OcgLocation.HAND),
          active(3, OcgLocation.HAND),
        ],
      }),
      world(),
    );
    expect(r).toEqual({
      type: OcgResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.SELECT_ACTIVATE,
      index: 2,
    });
  });

  it("n'insiste pas sur un effet qui ne mène à rien (anti-boucle)", () => {
    const bot = new DuelBot();
    const m = idle({ activates: [active(4, OcgLocation.HAND)], to_bp: false });
    bot.respond(m, world());
    bot.respond(m, world());
    expect(bot.respond(m, world())).toMatchObject({ action: SelectIdleCMDAction.TO_EP });
  });

  it("Invoque le meilleur monstre, ou le Pose s'il ne tient pas face à ton Terrain", () => {
    const summons = [card(2, OcgLocation.HAND), card(1, OcgLocation.HAND, BOT, 1)];
    expect(new DuelBot().respond(idle({ summons, monster_sets: summons }), world())).toMatchObject({
      action: SelectIdleCMDAction.SELECT_SUMMON,
      index: 1,
    });
    const strong = world({ theirs: [mon(9, 0, 2500)] });
    expect(new DuelBot().respond(idle({ summons, monster_sets: summons }), strong)).toMatchObject({
      action: SelectIdleCMDAction.SELECT_MONSTER_SET,
      index: 0,
    });
  });

  it('pose ses Pièges puis passe en Battle Phase avec un attaquant', () => {
    const bot = new DuelBot();
    const w = world({ mine: [mon(1, 0, 1800)] });
    const m = idle({ spell_sets: [card(5, OcgLocation.HAND)] });
    expect(bot.respond(m, w)).toMatchObject({ action: SelectIdleCMDAction.SELECT_SPELL_SET });
    expect(bot.respond(idle(), w)).toMatchObject({ action: SelectIdleCMDAction.TO_BP });
  });
});

describe('DuelBot — combat', () => {
  const battle = (attacks: object[]) =>
    msg({
      type: OcgMessageType.SELECT_BATTLECMD,
      player: BOT,
      chains: [],
      attacks,
      to_m2: true,
      to_ep: true,
    });

  it('attaque un monstre plus faible et le vise au moment de choisir la cible', () => {
    const bot = new DuelBot();
    const w = world({ mine: [mon(1, 0, 1800)], theirs: [mon(9, 0, 2500), mon(8, 3, 1200)] });
    const r = bot.respond(battle([{ ...card(1, OcgLocation.MZONE), can_direct: false }]), w);
    expect(r).toMatchObject({ action: SelectBattleCMDAction.SELECT_BATTLE, index: 0 });
    const target = bot.respond(
      msg({
        type: OcgMessageType.SELECT_CARD,
        player: BOT,
        can_cancel: false,
        min: 1,
        max: 1,
        selects: [card(9, OcgLocation.MZONE, 0, 0), card(8, OcgLocation.MZONE, 0, 3)],
      }),
      { ...w, hintCode: 549 },
    );
    expect(target).toEqual({ type: OcgResponseType.SELECT_CARD, indicies: [1] });
  });

  it("n'attaque pas un monstre plus fort", () => {
    const w = world({ mine: [mon(2, 0, 1000)], theirs: [mon(9, 0, 2500)] });
    expect(
      new DuelBot().respond(battle([{ ...card(2, OcgLocation.MZONE), can_direct: false }]), w),
    ).toMatchObject({ action: SelectBattleCMDAction.TO_M2 });
  });

  it('juge une attaque sur un monstre face verso avec une DEF supposée', () => {
    expect(beats(1600, mon(9, 0, 0, 0, false))).not.toBeNull();
    expect(beats(1400, mon(9, 0, 0, 0, false))).toBeNull();
  });
});

describe('DuelBot — réactions', () => {
  const chain = msg({
    type: OcgMessageType.SELECT_CHAIN,
    player: BOT,
    forced: false,
    spe_count: 0,
    hint_timing: 0,
    hint_timing_other: 0,
    selects: [
      { ...active(4, OcgLocation.SZONE), position: OcgPosition.FACEDOWN },
      { ...active(6, OcgLocation.HAND), position: 0 },
    ],
  });

  it('ne réagit pas quand tu ne fais rien', () => {
    expect(new DuelBot().respond(chain, world())).toEqual({
      type: OcgResponseType.SELECT_CHAIN,
      index: null,
    });
  });

  it('répond à ton activation avec sa hand trap', () => {
    const bot = new DuelBot();
    bot.observe(
      { type: OcgMessageType.CHAINING, code: 1, controller: 0 } as unknown as OcgMessage,
      BOT,
    );
    expect(bot.respond(chain, world())).toEqual({ type: OcgResponseType.SELECT_CHAIN, index: 1 });
  });
});

describe('DuelBot — sélections', () => {
  it('sacrifie ses cartes les moins utiles, vise les meilleures des tiennes', () => {
    const select = (hintCode: number, selects: object[]) =>
      new DuelBot().respond(
        msg({
          type: OcgMessageType.SELECT_CARD,
          player: BOT,
          can_cancel: false,
          min: 1,
          max: 1,
          selects,
        }),
        world({ hintCode }),
      );
    const own = [
      card(1, OcgLocation.HAND),
      card(2, OcgLocation.HAND, BOT, 1),
      card(4, OcgLocation.HAND, BOT, 2),
    ];
    // Défausser (501) : la carte la moins utile
    expect(select(501, own)).toEqual({ type: OcgResponseType.SELECT_CARD, indicies: [2] });
    // Ajouter à la main (506) : la meilleure
    expect(select(506, own)).toEqual({ type: OcgResponseType.SELECT_CARD, indicies: [1] });
    // Détruire (502) sur tout le Terrain : une carte adverse
    expect(select(502, [card(1, OcgLocation.HAND), card(2, OcgLocation.GRAVE, 0)])).toEqual({
      type: OcgResponseType.SELECT_CARD,
      indicies: [1],
    });
  });

  it('trouve des matériels dont les Niveaux font exactement le total', () => {
    expect(
      findSum(
        [
          { i: 0, levels: [3] },
          { i: 1, levels: [5] },
          { i: 2, levels: [2, 4] },
        ],
        7,
      ),
    ).toEqual([0, 2]);
    expect(findSum([{ i: 0, levels: [3] }], 7)).toBeNull();
  });

  it('se replie sur la réponse passive quand le moteur refuse la sienne', () => {
    const r = new DuelBot().respond(idle({ activates: [active(4, OcgLocation.HAND)] }), world(), 1);
    expect(r).toMatchObject({ action: SelectIdleCMDAction.TO_EP });
  });
});
