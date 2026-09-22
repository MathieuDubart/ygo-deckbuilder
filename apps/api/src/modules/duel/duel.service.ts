import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OcgLocation, OcgPosition, OcgType } from 'ocgcore-wasm';
import type { CardSummaryDto, CreateDuelInput, DuelResponseInput, DuelStateDto } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  cardSummarySelect,
  toCardSummary,
  type CardSummaryRow,
} from '../../common/mappers/card.mapper';
import { t } from '../../common/i18n/locale-context';
import { AppConfig } from '../../config/app-config.service';
import { DuelDataService } from './data/duel-data.service';
import { ocgCore } from './engine/core';
import { InvalidResponseError } from './engine/prompts';
import { DuelSession, type DuelSetupCard } from './duel-session';

/** Duels ouverts en même temps par un utilisateur (le plus ancien est fermé au-delà). */
const MAX_PER_USER = 2;

/**
 * Duels en mémoire (le moteur garde son état dans son propre tas WebAssembly) : création à
 * partir d'un deck de l'utilisateur, réponses, fermeture des duels inactifs.
 */
@Injectable()
export class DuelService implements OnModuleDestroy {
  private readonly logger = new Logger(DuelService.name);
  private readonly sessions = new Map<string, DuelSession>();
  /** Résumés des cartes déjà chargés (lignes brutes : le nom localisé est calculé par requête) */
  private readonly rows = new Map<number, CardSummaryRow | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly data: DuelDataService,
    private readonly config: AppConfig,
  ) {}

  onModuleDestroy(): void {
    for (const s of this.sessions.values()) s.destroy();
    this.sessions.clear();
  }

  status() {
    return this.data.status();
  }

  async create(userId: string, input: CreateDuelInput): Promise<DuelStateDto> {
    if (!this.data.enabled) throw new ServiceUnavailableException(t('duel.errors.disabled'));
    if (!this.data.ready) {
      void this.data.ensure().catch(() => undefined);
      throw new ServiceUnavailableException(t('duel.errors.notReady'));
    }

    const [mine, theirs] = await Promise.all([
      this.deckCards(userId, input.deckId),
      input.opponent.deckId ? this.deckCards(userId, input.opponent.deckId) : null,
    ]);
    const userTeam: 0 | 1 = input.goingFirst ? 0 : 1;
    const oppTeam = (1 - userTeam) as 0 | 1;
    const cards: DuelSetupCard[] = [];

    // Main de départ imposée : retirée du deck, posée en main
    const main = [...mine.main];
    const opening: number[] = [];
    for (const code of input.openingHand) {
      const i = main.indexOf(code);
      if (i >= 0) opening.push(...main.splice(i, 1));
    }
    this.addDeck(cards, userTeam, main, mine.extra);
    for (const code of opening)
      cards.push(this.card(userTeam, code, OcgLocation.HAND, 0, OcgPosition.FACEDOWN_DEFENSE));

    // Adversaire : son deck (ou une copie du tien pour qu'il puisse piocher), puis le plateau imposé
    const opp = theirs ?? mine;
    this.addDeck(cards, oppTeam, [...opp.main], opp.extra);
    const board = this.board(oppTeam, input.opponent.board);
    cards.push(...board);

    const startingDraw: [number, number] = [0, 0];
    startingDraw[userTeam] = Math.max(0, 5 - opening.length);
    // Avec un plateau imposé, sa main se limite aux cartes choisies
    startingDraw[oppTeam] = input.opponent.board.length ? 0 : 5;

    this.evict(userId);
    const core = await ocgCore();
    let session: DuelSession;
    try {
      session = DuelSession.create(core, this.data, {
        userId,
        userTeam,
        opponentControl: input.opponent.control,
        startingLP: input.startingLP,
        startingDraw,
        cards,
      });
    } catch (e) {
      this.logger.warn(`Création du duel impossible : ${(e as Error).message}`);
      throw new ServiceUnavailableException(t('duel.errors.engine'));
    }
    this.sessions.set(session.id, session);
    return this.state(session);
  }

  async get(userId: string, id: string): Promise<DuelStateDto> {
    return this.state(this.session(userId, id));
  }

  async respond(userId: string, id: string, input: DuelResponseInput): Promise<DuelStateDto> {
    const session = this.session(userId, id);
    try {
      session.respond(input);
    } catch (e) {
      if (e instanceof InvalidResponseError)
        throw new BadRequestException(t('duel.errors.invalidResponse'));
      this.logger.warn(`Duel ${id} : ${(e as Error).message}`);
      this.close(id);
      throw new ServiceUnavailableException(t('duel.errors.engine'));
    }
    return this.state(session);
  }

  close(id: string): void {
    this.sessions.get(id)?.destroy();
    this.sessions.delete(id);
  }

  remove(userId: string, id: string): void {
    this.session(userId, id);
    this.close(id);
  }

  /** Ferme les duels inactifs. */
  @Interval(60_000)
  sweep(): void {
    const idleMs = this.config.get('DUEL_IDLE_MINUTES') * 60_000;
    const now = Date.now();
    for (const [id, s] of this.sessions) if (now - s.lastActive > idleMs) this.close(id);
  }

  private session(userId: string, id: string): DuelSession {
    const session = this.sessions.get(id);
    if (!session || session.userId !== userId)
      throw new NotFoundException(t('duel.errors.notFound'));
    session.lastActive = Date.now();
    return session;
  }

  /** Limite par utilisateur et au total : on ferme les plus anciens. */
  private evict(userId: string): void {
    const byAge = [...this.sessions.values()].sort((a, b) => a.lastActive - b.lastActive);
    const own = byAge.filter((s) => s.userId === userId);
    while (own.length >= MAX_PER_USER) this.close(own.shift()!.id);
    const all = [...this.sessions.values()].sort((a, b) => a.lastActive - b.lastActive);
    while (all.length >= this.config.get('DUEL_MAX_SESSIONS')) this.close(all.shift()!.id);
  }

  private async deckCards(
    userId: string,
    deckId: string,
  ): Promise<{ main: number[]; extra: number[] }> {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { cards: { select: { cardId: true, zone: true, quantity: true } } },
    });
    if (!deck) throw new NotFoundException(t('errors.deckNotFound'));
    const main: number[] = [];
    const extra: number[] = [];
    for (const c of deck.cards) {
      if (!this.data.card(c.cardId)) continue; // carte inconnue du moteur (très récente…)
      if (c.zone === 'MAIN') for (let i = 0; i < c.quantity; i++) main.push(c.cardId);
      if (c.zone === 'EXTRA') for (let i = 0; i < c.quantity; i++) extra.push(c.cardId);
    }
    if (main.length === 0) throw new BadRequestException(t('duel.errors.emptyDeck'));
    return { main, extra };
  }

  /** Deck mélangé (chaque carte ajoutée « sur le dessus »), Extra Deck face verso. */
  private addDeck(cards: DuelSetupCard[], team: 0 | 1, main: number[], extra: number[]): void {
    for (let i = main.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [main[i], main[j]] = [main[j]!, main[i]!];
    }
    for (const code of main)
      cards.push(this.card(team, code, OcgLocation.DECK, 0, OcgPosition.FACEDOWN_DEFENSE));
    for (const code of extra)
      cards.push(this.card(team, code, OcgLocation.EXTRA, 0, OcgPosition.FACEDOWN_DEFENSE));
  }

  private card(
    team: 0 | 1,
    code: number,
    location: number,
    sequence: number,
    position: number,
  ): DuelSetupCard {
    return { code, team, location, sequence, position };
  }

  /** Plateau adverse imposé : zones libres attribuées dans l'ordre, cartes inconnues ignorées. */
  private board(team: 0 | 1, board: CreateDuelInput['opponent']['board']): DuelSetupCard[] {
    const out: DuelSetupCard[] = [];
    const used = { MZONE: new Set<number>(), SZONE: new Set<number>() };
    const free = (kind: 'MZONE' | 'SZONE', wanted?: number) => {
      if (wanted !== undefined && !used[kind].has(wanted)) return wanted;
      return [0, 1, 2, 3, 4].find((i) => !used[kind].has(i));
    };
    for (const c of board) {
      const data = this.data.card(c.cardId);
      if (!data) continue;
      const isMonster = (Number(data.type) & OcgType.MONSTER) !== 0;
      switch (c.location) {
        case 'MZONE': {
          if (!isMonster) continue;
          const seq = free('MZONE', c.zone);
          if (seq === undefined) continue;
          used.MZONE.add(seq);
          const position =
            c.position === 'SET'
              ? OcgPosition.FACEDOWN_DEFENSE
              : c.position === 'DEFENSE'
                ? OcgPosition.FACEUP_DEFENSE
                : OcgPosition.FACEUP_ATTACK;
          out.push(this.card(team, c.cardId, OcgLocation.MZONE, seq, position));
          break;
        }
        case 'SZONE': {
          const seq = free('SZONE', c.zone);
          if (seq === undefined) continue;
          used.SZONE.add(seq);
          const position = c.position === 'SET' ? OcgPosition.FACEDOWN : OcgPosition.FACEUP;
          out.push(this.card(team, c.cardId, OcgLocation.SZONE, seq, position));
          break;
        }
        case 'FZONE':
          out.push(
            this.card(
              team,
              c.cardId,
              OcgLocation.SZONE,
              5,
              c.position === 'SET' ? OcgPosition.FACEDOWN : OcgPosition.FACEUP,
            ),
          );
          break;
        case 'HAND':
          out.push(this.card(team, c.cardId, OcgLocation.HAND, 0, OcgPosition.FACEDOWN_DEFENSE));
          break;
        case 'GRAVE':
          out.push(this.card(team, c.cardId, OcgLocation.GRAVE, 0, OcgPosition.FACEUP));
          break;
        case 'BANISHED':
          out.push(this.card(team, c.cardId, OcgLocation.REMOVED, 0, OcgPosition.FACEUP));
          break;
      }
    }
    return out;
  }

  // MARK: - Cartes citées

  private async state(session: DuelSession): Promise<DuelStateDto> {
    const { codes, ...snapshot } = session.snapshot();
    return { ...snapshot, cards: await this.summaries(codes) };
  }

  private async summaries(codes: Set<number>): Promise<Record<string, CardSummaryDto>> {
    const alias = (code: number) => {
      const a = this.data.card(code)?.alias;
      return a && a !== code ? a : code;
    };
    const missing = [...codes].filter((c) => !this.rows.has(c));
    if (missing.length) {
      const wanted = [...new Set([...missing, ...missing.map(alias)])];
      const found = await this.prisma.card.findMany({
        where: { id: { in: wanted } },
        select: cardSummarySelect,
      });
      const byId = new Map(found.map((r) => [r.id, r]));
      for (const code of missing)
        this.rows.set(code, byId.get(code) ?? byId.get(alias(code)) ?? null);
    }
    const out: Record<string, CardSummaryDto> = {};
    for (const code of codes) {
      const row = this.rows.get(code);
      // `id` = carte du catalogue (illustration alternative → carte d'origine), pour sa fiche
      out[code] = row ? toCardSummary(row) : this.fallback(code);
    }
    return out;
  }

  /** Carte absente du catalogue (Token, carte très récente) : résumé depuis la base du moteur. */
  private fallback(code: number): CardSummaryDto {
    const data = this.data.card(code);
    const type = Number(data?.type ?? 0);
    const category =
      type & OcgType.TOKEN
        ? 'TOKEN'
        : type & OcgType.SPELL
          ? 'SPELL'
          : type & OcgType.TRAP
            ? 'TRAP'
            : 'MONSTER';
    return {
      id: code,
      name: this.data.text(code)?.name ?? `#${code}`,
      category,
      type: category === 'TOKEN' ? 'Token' : category,
      frameType: category.toLowerCase(),
      archetype: null,
      attribute: null,
      race: null,
      level: data?.level || null,
      atk: data && type & OcgType.MONSTER ? data.attack : null,
      def: data && type & OcgType.MONSTER && !(type & OcgType.LINK) ? data.defense : null,
      imageUrl: null,
      imageUrlSmall: null,
      isExtraDeck: !!(type & (OcgType.FUSION | OcgType.SYNCHRO | OcgType.XYZ | OcgType.LINK)),
      banTcg: null,
      priceCardmarket: null,
    };
  }
}
