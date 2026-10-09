import { Injectable, Logger } from '@nestjs/common';
import type { DeckProfileDto, DeckStrengthDto, MatchupDto } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scoreDeck } from '../meta-decks/engine/generator';
import { analyzeDeck, type DeckEntry, type Zone } from '../synergy/engine/graph';
import {
  allMatchups,
  matchup,
  profileDeck,
  type DeckProfile,
  type DeckStyle,
} from '../synergy/engine/profile';
import { SynergyCardsService, type FullCard } from '../synergy/synergy-cards.service';
import { asGenerationResult } from './deck-strength';

/** Une ligne de deck telle que la base la porte. */
export interface DeckCardRow {
  cardId: number;
  zone: Zone;
  quantity: number;
}

/** En dessous, une note ne voudrait rien dire : ce n'est pas encore un deck. */
const MIN_MAIN_TO_RATE = 20;

/**
 * La force d'un deck : sa note, sa forme, et contre quoi elle vaut.
 *
 * Tout le calcul est déjà écrit ailleurs, en fonctions pures et testées — ce service ne
 * fait que leur apporter les données : les textes des cartes, les staples du moment, et les
 * listes du meta pour nommer les adversaires. Il n'ajoute aucune règle.
 *
 * Les profils du meta sont gardés en mémoire : ils ne changent qu'à la synchro, et les
 * recalculer à chaque affichage reviendrait à relire les textes de plusieurs centaines de
 * cartes pour rien.
 */
@Injectable()
export class DeckStrengthService {
  private readonly logger = new Logger(DeckStrengthService.name);
  private metaProfiles: { at: Date | null; decks: { name: string; profile: DeckProfile }[] } = {
    at: null,
    decks: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: SynergyCardsService,
  ) {}

  /**
   * Note plusieurs decks d'un coup. Un seul chargement de cartes pour tous : une liste de
   * decks en demande quelques centaines, et les redemander deck par deck serait le genre de
   * détail qui rend une page lente sans qu'on sache pourquoi.
   */
  async rateMany(decks: Map<string, DeckCardRow[]>): Promise<Map<string, DeckStrengthDto>> {
    const ids = [...new Set([...decks.values()].flatMap((rows) => rows.map((r) => r.cardId)))];
    if (!ids.length) return new Map();
    const [cards, staples] = await Promise.all([this.cards.load(ids), this.stapleIds()]);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const meta = await this.metaOpponents();

    const out = new Map<string, DeckStrengthDto>();
    for (const [deckId, rows] of decks) {
      const strength = this.rate(rows, byId, staples, meta);
      if (strength) out.set(deckId, strength);
    }
    return out;
  }

  /** La force d'un seul deck. */
  async rateOne(rows: DeckCardRow[]): Promise<DeckStrengthDto | null> {
    const result = await this.rateMany(new Map([['one', rows]]));
    return result.get('one') ?? null;
  }

  private rate(
    rows: DeckCardRow[],
    byId: Map<number, FullCard>,
    staples: Set<number>,
    meta: { name: string; profile: DeckProfile }[],
  ): DeckStrengthDto | null {
    const entries: DeckEntry[] = rows.flatMap((row) => {
      const card = byId.get(row.cardId);
      return card ? [{ card, quantity: row.quantity, zone: row.zone }] : [];
    });
    const main = entries
      .filter((e) => e.zone === 'MAIN')
      .reduce((sum, e) => sum + e.quantity, 0);
    if (main < MIN_MAIN_TO_RATE) return null;

    const analysis = analyzeDeck(entries);
    const profile = profileDeck(entries, analysis);
    const score = scoreDeck(asGenerationResult(entries, analysis, staples), {
      stapleIds: staples,
      synergy: { score: analysis.synergy.score, starterCopies: analysis.synergy.starterCopies },
    });

    return {
      score: {
        ...score,
        engineShare: round(score.engineShare),
        consistency: round(score.consistency),
        fillerShare: round(score.fillerShare),
        metaCoverage: score.metaCoverage === null ? null : round(score.metaCoverage),
        synergy: score.synergy === null ? null : round(score.synergy),
      },
      profile: toProfileDto(profile),
      matchups: this.matchupsFor(profile, meta),
    };
  }

  /**
   * Les pronostics. Contre les decks du meta quand on les connaît — un nom vaut mieux
   * qu'une catégorie — et contre les cinq formes de jeu sinon, pour que l'écran dise
   * toujours quelque chose, y compris sur une installation qui n'a jamais synchronisé.
   */
  private matchupsFor(
    mine: DeckProfile,
    meta: { name: string; profile: DeckProfile }[],
  ): MatchupDto[] {
    if (!meta.length) {
      return allMatchups(mine).map((m) => ({ ...m, opponent: null }));
    }
    return meta
      .map(({ name, profile }) => ({
        ...matchup(mine, profile.style, profile),
        opponent: name,
      }))
      .sort((a, b) => b.edge - a.edge);
  }

  /** Les staples du moment, tels que la synchro meta les a calculés. */
  private async stapleIds(): Promise<Set<number>> {
    const rows = await this.prisma.cardMetaStat.findMany({
      where: { isStaple: true },
      select: { cardId: true },
    });
    return new Set(rows.map((r) => r.cardId));
  }

  /**
   * Les decks du meta, profilés une fois par synchro. On garde les mieux représentés : au
   * delà d'une dizaine, la liste des pronostics devient illisible sans rien apprendre.
   */
  private async metaOpponents(): Promise<{ name: string; profile: DeckProfile }[]> {
    const latest = await this.prisma.metaDeck.findFirst({
      where: { source: 'tournaments' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    if (!latest) return [];
    if (this.metaProfiles.at && this.metaProfiles.at.getTime() === latest.updatedAt.getTime()) {
      return this.metaProfiles.decks;
    }

    const decks = await this.prisma.metaDeck.findMany({
      where: { source: 'tournaments' },
      orderBy: { share: 'desc' },
      take: 8,
      select: { name: true, cards: { select: { cardId: true, zone: true, quantity: true } } },
    });
    const ids = [...new Set(decks.flatMap((d) => d.cards.map((c) => c.cardId)))];
    const byId = new Map((await this.cards.load(ids)).map((c) => [c.id, c]));

    const profiles = decks.flatMap((deck) => {
      const entries: DeckEntry[] = deck.cards.flatMap((c) => {
        const card = byId.get(c.cardId);
        return card ? [{ card, quantity: c.quantity, zone: c.zone as Zone }] : [];
      });
      if (!entries.length) return [];
      const analysis = analyzeDeck(entries);
      return [{ name: deck.name, profile: profileDeck(entries, analysis) }];
    });
    this.metaProfiles = { at: latest.updatedAt, decks: profiles };
    this.logger.log(`Profils du meta recalculés (${profiles.length} decks)`);
    return profiles;
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

const toProfileDto = (p: DeckProfile): DeckProfileDto => ({
  style: p.style as DeckStyle,
  setup: round(p.setup),
  disruption: round(p.disruption),
  handInteraction: round(p.handInteraction),
  breaking: round(p.breaking),
  lock: round(p.lock),
  resilience: round(p.resilience),
  consistency: round(p.consistency),
});
