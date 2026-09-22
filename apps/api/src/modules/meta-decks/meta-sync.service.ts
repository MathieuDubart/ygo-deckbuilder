import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { setTimeout as sleep } from 'node:timers/promises';
import { CardResolver } from '../../common/catalog/card-resolver.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { YgoprodeckClient } from '../catalog-sync/ygoprodeck.client';
import type { YgoTournamentDeck } from '../catalog-sync/ygoprodeck.types';
import { clusterLists } from './engine/clustering';
import { buildConsensus } from './engine/consensus';
import { cardStats, crossArchetypeStaples } from './engine/stats';
import type { TournamentList } from './engine/types';

const SYNC_ID = 'meta';
/** Listes conservées pour le calcul (les plus récentes). */
const MAX_LISTS = 400;
/** Un archétype doit avoir au moins ce nombre de listes pour apparaître dans le meta. */
const MIN_LISTS = 2;

export interface MetaSyncResult {
  fetched: number;
  lists: number;
  archetypes: number;
  staples: number;
}

/**
 * Meta automatique : récupère les decklists des tournois récents (YGOPRODeck),
 * les regroupe en archétypes par similarité, calcule une liste type par archétype
 * et la popularité de chaque carte (staples).
 */
@Injectable()
export class MetaSyncService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(MetaSyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ygo: YgoprodeckClient,
    private readonly resolver: CardResolver,
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cron = this.config.get('META_SYNC_CRON');
    if (!cron) return;
    const job = CronJob.from({
      cronTime: cron,
      onTick: () => void this.sync().catch((e) => this.logger.error(e)),
    });
    this.scheduler.addCronJob('meta-sync', job);
    job.start();
  }

  /** Premier démarrage (catalogue déjà là, meta vide) → on calcule le meta en arrière-plan. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('META_SYNC_CRON')) return;
    const [lists, cards] = await Promise.all([
      this.prisma.tournamentDeck.count(),
      this.prisma.card.count(),
    ]);
    if (lists === 0 && cards > 0) {
      void this.sync().catch((e) => this.logger.warn(`Meta : ${e}`));
    }
  }

  status() {
    return this.prisma.syncState.findUnique({ where: { id: SYNC_ID } });
  }

  async sync(): Promise<MetaSyncResult> {
    if (this.running) throw new Error('Mise à jour du meta déjà en cours');
    this.running = true;
    try {
      const fetched = await this.fetchLists();
      const result = await this.recompute();
      await this.saveState('OK', { ...result, fetched });
      this.logger.log(
        `Meta : ${fetched} listes récupérées, ${result.archetypes} archétypes, ${result.staples} staples`,
      );
      return { ...result, fetched };
    } catch (e) {
      await this.saveState('ERROR', undefined, String(e));
      throw e;
    } finally {
      this.running = false;
    }
  }

  private async fetchLists(): Promise<number> {
    let fetched = 0;
    const pages = this.config.get('META_SYNC_PAGES');
    let offset = 0;
    for (let page = 0; page < pages; page++) {
      const decks = await this.ygo.tournamentDecks(offset);
      if (!decks.length) break;
      offset += decks.length;
      fetched += await this.storeLists(decks);
      await sleep(1000); // politesse envers YGOPRODeck
    }
    // On ne garde que les plus récentes
    const old = await this.prisma.tournamentDeck.findMany({
      orderBy: { id: 'desc' },
      skip: MAX_LISTS,
      select: { id: true },
    });
    if (old.length) {
      await this.prisma.tournamentDeck.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
    return fetched;
  }

  private async storeLists(decks: YgoTournamentDeck[]): Promise<number> {
    const parsed = decks.map((d) => ({
      deck: d,
      main: parseIds(d.main_deck),
      extra: parseIds(d.extra_deck),
      side: parseIds(d.side_deck),
    }));
    const ids = await this.resolver.resolve(
      parsed.flatMap((p) => [...p.main, ...p.extra, ...p.side]),
    );
    const rows = parsed
      .map((p) => ({
        id: p.deck.deckNum,
        name: p.deck.deck_name.trim(),
        tournament: p.deck.tournamentName ?? null,
        placement: p.deck.tournamentPlacement ?? null,
        playerCount: p.deck.tournamentPlayerCount ?? null,
        main: CardResolver.apply(p.main, ids),
        extra: CardResolver.apply(p.extra, ids),
        side: CardResolver.apply(p.side, ids),
        url: p.deck.pretty_url ? `https://ygoprodeck.com/deck/${p.deck.pretty_url}` : null,
      }))
      .filter((r) => r.main.length >= 40); // liste incomplète / cartes pas encore au catalogue

    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.tournamentDeck.upsert({ where: { id: r.id }, create: r, update: r }),
      ),
    );
    return rows.length;
  }

  /** Recalcule archétypes, listes types et popularité à partir des listes stockées. */
  async recompute(): Promise<Omit<MetaSyncResult, 'fetched'>> {
    const stored = await this.prisma.tournamentDeck.findMany({
      orderBy: { id: 'desc' },
      take: MAX_LISTS,
    });
    const lists: TournamentList[] = stored.map((s) => ({
      id: s.id,
      name: s.name,
      main: s.main,
      extra: s.extra,
      side: s.side,
    }));
    const clusters = clusterLists(lists).filter((c) => c.lists.length >= MIN_LISTS);
    const stats = cardStats(lists);
    const staples = crossArchetypeStaples(clusters.map((c) => c.lists));

    // Archétype "officiel" (champ YGOPRODeck) le plus représenté dans chaque liste type
    const templates = clusters.map((c) => ({ cluster: c, template: buildConsensus(c.lists) }));
    const archetypeOf = await this.dominantArchetypes(
      templates.map((t) => t.template.cards.filter((c) => c.zone === 'MAIN')),
    );

    // Les decks importés à la main gardent leur nom : on évite les collisions
    const manualNames = (
      await this.prisma.metaDeck.findMany({
        where: { source: { not: 'tournaments' } },
        select: { name: true },
      })
    ).map((d) => d.name);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.metaDeck.deleteMany({ where: { source: 'tournaments' } });
        for (const [i, { cluster, template }] of templates.entries()) {
          const deck = await tx.metaDeck.create({
            data: {
              name: uniqueName(cluster.name, [
                ...manualNames,
                ...templates.slice(0, i).map((t) => t.cluster.name),
              ]),
              archetype: archetypeOf[i] ?? null,
              tier: cluster.tier,
              format: 'TCG',
              source: 'tournaments',
              sourceUrl: 'https://ygoprodeck.com/category/format/tournament%20meta%20decks',
              listCount: cluster.lists.length,
              share: cluster.share,
              variants: cluster.variants,
              cards: {
                create: [
                  ...template.cards.map((c) => ({ ...c, flex: false })),
                  ...template.flex.map((c) => ({ ...c, flex: true })),
                ],
              },
            },
          });
          await tx.tournamentDeck.updateMany({
            where: { id: { in: cluster.lists.map((l) => l.id) } },
            data: { metaDeckId: deck.id },
          });
        }

        await tx.cardMetaStat.deleteMany();
        await tx.cardMetaStat.createMany({
          data: [...stats].map(([cardId, s]) => ({
            cardId,
            deckShare: s.share,
            avgCopies: s.avgCopies,
            isStaple: staples.has(cardId),
          })),
        });
      },
      { timeout: 60_000 },
    );

    return { lists: lists.length, archetypes: clusters.length, staples: staples.size };
  }

  private async dominantArchetypes(
    mains: { cardId: number; quantity: number }[][],
  ): Promise<(string | null)[]> {
    const ids = [...new Set(mains.flat().map((c) => c.cardId))];
    const cards = await this.prisma.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, archetype: true },
    });
    const arch = new Map(cards.map((c) => [c.id, c.archetype]));
    return mains.map((main) => {
      const counts = new Map<string, number>();
      for (const c of main) {
        const a = arch.get(c.cardId);
        if (a) counts.set(a, (counts.get(a) ?? 0) + c.quantity);
      }
      return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    });
  }

  private async saveState(status: string, result?: MetaSyncResult, error?: string) {
    const data = {
      lastSyncAt: new Date(),
      lastStatus: status,
      lastError: error ?? null,
      ...(result && { cardCount: result.lists }),
    };
    await this.prisma.syncState.upsert({
      where: { id: SYNC_ID },
      create: { id: SYNC_ID, ...data },
      update: data,
    });
  }
}

function parseIds(raw: string): number[] {
  try {
    const arr = JSON.parse(raw) as (string | number)[];
    return arr.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

/** Deux groupes peuvent porter le même nom le plus fréquent : on les distingue. */
function uniqueName(name: string, taken: string[]): string {
  const n = taken.filter((t) => t === name).length;
  return n === 0 ? name : `${name} (${n + 1})`;
}
