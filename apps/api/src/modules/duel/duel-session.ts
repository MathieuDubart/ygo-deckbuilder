import { randomUUID } from 'node:crypto';
import {
  OcgDuelMode,
  OcgLocation,
  OcgMessageType,
  OcgPosition,
  OcgProcessResult,
  OcgQueryFlags,
  type OcgCardQueryInfo,
  type OcgCoreSync,
  type OcgDuelHandle,
  type OcgResponse,
} from 'ocgcore-wasm';
import type {
  DuelCardDto,
  DuelEventDto,
  DuelOpponentControl,
  DuelPlayerDto,
  DuelPromptDto,
  DuelResponseInput,
  DuelStateDto,
} from '@ygo/shared';
import { applyMessage, newTracker, type DuelTracker } from './engine/events';
import {
  autoResponse,
  InvalidResponseError,
  isSelectMessage,
  isTrivial,
  toPrompt,
  toResponse,
  type SelectMessage,
} from './engine/prompts';
import { toLocation, toPosition, DuelView } from './engine/view';
import type { DuelDataService } from './data/duel-data.service';

/** Carte à placer au début du duel (deck, main imposée, plateau adverse). */
export interface DuelSetupCard {
  code: number;
  /** Équipe du moteur propriétaire */
  team: 0 | 1;
  location: number;
  sequence: number;
  position: number;
}

export interface DuelSetup {
  userId: string;
  userTeam: 0 | 1;
  opponentControl: DuelOpponentControl;
  startingLP: number;
  /** Cartes piochées au début par équipe */
  startingDraw: [number, number];
  cards: DuelSetupCard[];
}

const QUERY_FLAGS = (OcgQueryFlags.CODE |
  OcgQueryFlags.POSITION |
  OcgQueryFlags.ATTACK |
  OcgQueryFlags.DEFENSE |
  OcgQueryFlags.LEVEL |
  OcgQueryFlags.RANK |
  OcgQueryFlags.LINK |
  OcgQueryFlags.OVERLAY_CARD |
  OcgQueryFlags.COUNTERS |
  OcgQueryFlags.IS_PUBLIC) as OcgQueryFlags;

/** Garde-fous contre une boucle infinie du moteur ou des réponses automatiques refusées. */
const MAX_STEPS_PER_ADVANCE = 20_000;
const MAX_AUTO_RETRIES = 3;

type Location = DuelCardDto['location'];

/**
 * Un duel en cours : le handle du moteur, qui joue chaque siège (l'utilisateur ; l'adversaire
 * passif ou contrôlé par l'utilisateur), l'état suivi et le journal non encore envoyé.
 */
export class DuelSession {
  readonly id = randomUUID();
  readonly userId: string;
  readonly opponentControl: DuelOpponentControl;
  readonly view: DuelView;
  lastActive = Date.now();

  private readonly tracker: DuelTracker;
  private pending: SelectMessage | null = null;
  private pendingForUser = false;
  private promptId = 0;
  private prompt: DuelPromptDto | null = null;
  private autoRetries = 0;
  private seq = 0;
  private outbox: DuelEventDto[] = [];
  private destroyed = false;

  constructor(
    private readonly core: OcgCoreSync,
    private readonly handle: OcgDuelHandle,
    private readonly data: DuelDataService,
    setup: DuelSetup,
  ) {
    this.userId = setup.userId;
    this.opponentControl = setup.opponentControl;
    this.view = new DuelView(setup.userTeam);
    this.tracker = newTracker(setup.startingLP);
  }

  /** Crée le duel dans le moteur, place les cartes et joue jusqu'au premier choix de l'utilisateur. */
  static create(core: OcgCoreSync, data: DuelDataService, setup: DuelSetup): DuelSession {
    const seed = (): bigint =>
      BigInt.asUintN(64, BigInt(Math.floor(Math.random() * 2 ** 52)) * 4099n + 1n);
    const team = (draw: number) => ({
      startingLP: setup.startingLP,
      startingDrawCount: draw,
      drawCountPerTurn: 1,
    });
    const handle = core.createDuel({
      flags: OcgDuelMode.MODE_MR5,
      seed: [seed(), seed(), seed(), seed()],
      team1: team(setup.startingDraw[0]),
      team2: team(setup.startingDraw[1]),
      cardReader: (code) => data.card(code),
      scriptReader: (name) => data.script(name),
      errorHandler: () => undefined,
    });
    if (!handle) throw new Error('duel creation failed');

    for (const name of ['constant.lua', 'utility.lua']) {
      const script = data.script(name);
      if (!script || !core.loadScript(handle, name, script)) {
        core.destroyDuel(handle);
        throw new Error(`script ${name} missing`);
      }
    }
    for (const c of setup.cards) {
      core.duelNewCard(handle, {
        team: c.team,
        duelist: 0,
        code: c.code,
        controller: c.team,
        location: c.location as OcgLocation,
        sequence: c.sequence,
        position: c.position as OcgPosition,
      });
    }
    const session = new DuelSession(core, handle, data, setup);
    core.startDuel(handle);
    session.advance();
    return session;
  }

  get finished(): boolean {
    return this.tracker.winner !== null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.core.destroyDuel(this.handle);
  }

  /** Réponse de l'utilisateur à l'invite en cours. */
  respond(input: DuelResponseInput): void {
    if (this.destroyed || this.finished) throw new InvalidResponseError('finished');
    if (!this.pending || !this.pendingForUser || !this.prompt)
      throw new InvalidResponseError('no prompt');
    if (input.promptId !== this.prompt.id) throw new InvalidResponseError('stale prompt');
    const response = toResponse(this.pending, input, this.view);
    this.lastActive = Date.now();
    this.send(response, true);
    this.advance();
  }

  private send(response: OcgResponse, fromUser: boolean): void {
    this.pendingForUser = false;
    this.prompt = null;
    this.tracker.hint = null;
    if (!fromUser) this.autoRetries += 1;
    this.core.duelSetResponse(this.handle, response);
  }

  /** Fait avancer le moteur jusqu'au prochain choix de l'utilisateur (ou la fin du duel). */
  private advance(): void {
    for (let step = 0; step < MAX_STEPS_PER_ADVANCE; step++) {
      const status = this.core.duelProcess(this.handle);
      for (const msg of this.core.duelGetMessage(this.handle)) {
        if (msg.type === OcgMessageType.RETRY) {
          // Réponse refusée par le moteur : la même question reste posée
          continue;
        }
        if (isSelectMessage(msg)) {
          this.pending = msg;
          this.autoRetries = 0;
          continue;
        }
        this.record(msg);
      }
      if (status === OcgProcessResult.END || this.finished) {
        this.pending = null;
        this.prompt = null;
        return;
      }
      if (status === OcgProcessResult.CONTINUE) continue;

      const pending = this.pending;
      if (!pending) return;
      const player = this.view.player(pending.player);
      const userDecides = player === 0 || this.opponentControl === 'ME';
      const promptable = userDecides && !isTrivial(pending);
      // Une réponse automatique refusée plusieurs fois : on laisse l'utilisateur trancher
      if (!promptable && this.autoRetries < MAX_AUTO_RETRIES) {
        this.send(autoResponse(pending), false);
        continue;
      }
      const prompt = toPrompt(pending, {
        id: ++this.promptId,
        view: this.view,
        describe: (d) => this.data.describe(d),
        hint: this.tracker.hint,
        hidden: (c) => this.hidden(c),
      });
      if (!prompt) {
        this.send(autoResponse(pending), false);
        continue;
      }
      this.prompt = prompt;
      this.pendingForUser = true;
      this.tracker.hint = null;
      return;
    }
    throw new Error('duel engine did not settle');
  }

  private record(msg: Parameters<typeof applyMessage>[0]): void {
    const events = applyMessage(msg, this.tracker, {
      view: this.view,
      describe: (d) => this.data.describe(d),
      hidden: (c) => this.hidden(c),
      cardName: (code) => this.data.text(code)?.name ?? null,
      victoryReason: (r) => this.data.victoryReason(r),
      codeAt: (c) => this.codeAt(c),
    });
    for (const e of events) {
      this.outbox.push({ ...e, seq: ++this.seq, turn: this.tracker.turn } as DuelEventDto);
    }
  }

  /** Carte cachée à l'utilisateur ? (main, deck et cartes face verso de l'adversaire passif) */
  hidden(card: { controller: number; location: number; position?: number }): boolean {
    if (this.view.player(card.controller) === 0 || this.opponentControl === 'ME') return false;
    if (card.location === OcgLocation.HAND || card.location === OcgLocation.DECK) return true;
    if (card.location === OcgLocation.EXTRA) return true;
    return card.position !== undefined && (card.position & OcgPosition.FACEDOWN) !== 0;
  }

  private codeAt(card: { controller: number; location: number; sequence: number }): number {
    const info = this.core.duelQuery(this.handle, {
      flags: (OcgQueryFlags.CODE | OcgQueryFlags.POSITION) as OcgQueryFlags,
      controller: card.controller as 0 | 1,
      location: card.location as OcgLocation,
      sequence: card.sequence,
      overlaySequence: 0,
    });
    if (!info?.code) return 0;
    return this.hidden({ ...card, position: info.position }) ? 0 : info.code;
  }

  // MARK: - État envoyé au client

  /** État courant ; vide la file des événements du journal. */
  snapshot(): Omit<DuelStateDto, 'cards'> & { codes: Set<number> } {
    const codes = new Set<number>();
    const players = [0, 1].map((p) => this.player(p as 0 | 1, codes)) as [
      DuelPlayerDto,
      DuelPlayerDto,
    ];
    const events = this.outbox;
    this.outbox = [];
    for (const e of events) {
      if ('code' in e && e.code) codes.add(e.code);
      if (e.kind === 'ATTACK' && e.target) codes.add(e.target);
      if (e.kind === 'DRAW') e.codes.forEach((c) => codes.add(c));
    }
    const collect = (ref: { code: number }) => ref.code && codes.add(ref.code);
    this.tracker.chain.forEach((l) => collect(l.card));
    const prompt = this.prompt;
    if (prompt) {
      if (prompt.kind === 'IDLE' || prompt.kind === 'BATTLE')
        prompt.actions.forEach((a) => collect(a.card));
      if (prompt.kind === 'CHAIN') prompt.options.forEach((o) => collect(o.card));
      if (prompt.kind === 'SORT') prompt.cards.forEach((o) => collect(o.card));
      if (prompt.kind === 'SELECT_CARDS')
        [...prompt.cards, ...prompt.mustCards].forEach((o) => collect(o.card));
      if (prompt.kind === 'SELECT_UNSELECT')
        [...prompt.selectable, ...prompt.unselectable].forEach((o) => collect(o.card));
      if (prompt.kind === 'YESNO' && prompt.card) collect(prompt.card);
      if (prompt.kind === 'POSITION') codes.add(prompt.code);
    }
    return {
      id: this.id,
      turn: this.tracker.turn,
      turnPlayer: this.tracker.turnPlayer,
      phase: this.tracker.phase,
      players,
      chain: this.tracker.chain,
      prompt,
      events,
      opponentControl: this.opponentControl,
      finished: this.tracker.winner,
      codes,
    };
  }

  private player(player: 0 | 1, codes: Set<number>): DuelPlayerDto {
    const team = this.view.team(player);
    const read = (location: number) =>
      this.core.duelQueryLocation(this.handle, {
        flags: QUERY_FLAGS,
        controller: team,
        location: location as OcgLocation,
      });
    const card = (
      info: Partial<OcgCardQueryInfo> | null,
      location: number,
      sequence: number,
    ): DuelCardDto | null => {
      if (!info || !info.code) return null;
      const hidden =
        this.hidden({ controller: team, location, position: info.position }) && !info.isPublic;
      const code = hidden ? 0 : info.code;
      if (code) codes.add(code);
      const overlays = hidden ? [] : (info.overlayCards ?? []);
      overlays.forEach((c) => codes.add(c));
      const onField = location === OcgLocation.MZONE;
      return {
        controller: player,
        location: toLocation(location) as Location,
        sequence,
        code,
        position:
          location === OcgLocation.MZONE || location === OcgLocation.SZONE
            ? toPosition(info.position)
            : null,
        attack: onField && !hidden ? (info.attack ?? null) : null,
        defense: onField && !hidden && !info.link?.rating ? (info.defense ?? null) : null,
        level: hidden ? null : info.level || null,
        rank: hidden ? null : info.rank || null,
        link: hidden ? null : info.link?.rating || null,
        overlays,
        counters: Object.values(info.counters ?? {}).reduce((s, n) => s + n, 0),
      };
    };
    const list = (location: number) =>
      read(location)
        .map((info, i) => card(info, location, i))
        .filter((c): c is DuelCardDto => c !== null);
    const zones = (location: number, size: number) => {
      const infos = read(location);
      return Array.from({ length: size }, (_, i) => card(infos[i] ?? null, location, i));
    };
    const extra = list(OcgLocation.EXTRA);
    return {
      lp: this.tracker.lp[player],
      deckCount: this.core.duelQueryCount(this.handle, team, OcgLocation.DECK),
      extraCount: this.core.duelQueryCount(this.handle, team, OcgLocation.EXTRA),
      hand: list(OcgLocation.HAND),
      monsters: zones(OcgLocation.MZONE, 7),
      spells: zones(OcgLocation.SZONE, 6),
      grave: list(OcgLocation.GRAVE),
      banished: list(OcgLocation.REMOVED),
      extra: extra.filter((c) => c.code !== 0),
    };
  }
}
