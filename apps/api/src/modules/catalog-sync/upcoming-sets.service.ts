import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { parseUpcomingSets, upcomingSetsQuery } from './upcoming-sets.parser';
import { YugipediaClient } from './yugipedia.client';

/** État de synchro, dans la même table que celui du catalogue. */
const SYNC_ID = 'yugipedia-upcoming';
/** Horizon : une annonce porte rarement à plus d'un an, et 200 résultats couvrent large. */
const LIMIT = 200;
/** Marge en arrière : attrape la sortie du jour quel que soit le fuseau du serveur. */
const LOOKBACK_DAYS = 2;

/**
 * Sorties annoncées mais pas encore sorties. YGOPRODeck ne connaît une extension qu'une fois
 * ses cartes révélées ; Yugipedia la connaît dès l'annonce. On crée donc l'extension avec sa
 * date, quitte à ce qu'elle n'ait encore aucune impression — l'onglet Extensions sait
 * l'afficher comme « liste pas encore révélée », et la synchro du catalogue la remplira.
 */
@Injectable()
export class UpcomingSetsService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(UpcomingSetsService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly yugipedia: YugipediaClient,
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) return;
    // Tous les jours à 5h : les annonces tombent au fil de l'eau
    const job = CronJob.from({
      cronTime: '0 5 * * *',
      onTick: () => void this.refresh().catch((e) => this.logger.error(e)),
    });
    this.scheduler.addCronJob('upcoming-sets', job);
    job.start();
  }

  onApplicationBootstrap(): void {
    if (!this.enabled || !this.config.get('CARD_SYNC_ON_BOOT')) return;
    setTimeout(() => void this.refresh().catch((e) => this.logger.error(e)), 20_000);
  }

  private get enabled(): boolean {
    return this.config.get('PRODUCT_COVERS_ENABLED');
  }

  async refresh(): Promise<{ announced: number; created: number; updated: number }> {
    const idle = { announced: 0, created: 0, updated: 0 };
    if (this.running) return idle;
    this.running = true;
    try {
      const from = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
      const response = await this.yugipedia.ask(upcomingSetsQuery(from, LIMIT));
      const sets = parseUpcomingSets(response, new Date());
      if (!sets.length) {
        await this.saveState(0, 'OK');
        return idle;
      }

      const existing = await this.prisma.cardSet.findMany({
        where: { name: { in: sets.map((s) => s.name) } },
        select: { id: true, name: true },
      });
      const ids = new Map(existing.map((row) => [row.name, row.id]));

      let created = 0;
      let updated = 0;
      for (const set of sets) {
        const id = ids.get(set.name);
        if (id) {
          // La date annoncée fait foi : c'est la source la mieux informée des deux.
          await this.prisma.cardSet.update({
            where: { id },
            data: { tcgDate: set.tcgDate, announcedAt: new Date(), code: set.code ?? undefined },
          });
          updated += 1;
        } else {
          await this.prisma.cardSet.create({
            data: {
              name: set.name,
              code: set.code,
              tcgDate: set.tcgDate,
              announcedAt: new Date(),
            },
          });
          created += 1;
        }
      }
      await this.saveState(sets.length, 'OK');
      this.logger.log(
        `Sorties annoncées : ${sets.length} extensions (${created} nouvelles, ${updated} mises à jour)`,
      );
      return { announced: sets.length, created, updated };
    } catch (e) {
      await this.saveState(0, 'ERROR', String(e));
      throw e;
    } finally {
      this.running = false;
    }
  }

  private async saveState(count: number, status: string, error?: string): Promise<void> {
    const data = {
      lastSyncAt: new Date(),
      lastStatus: status,
      lastError: error ?? null,
      cardCount: count,
    };
    await this.prisma.syncState.upsert({
      where: { id: SYNC_ID },
      create: { id: SYNC_ID, ...data },
      update: data,
    });
  }
}
