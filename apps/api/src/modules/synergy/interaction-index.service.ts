import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import type { Prisma } from '../../generated/prisma/client';
import { featuresOf } from './engine/graph';
import { targetsOfCard } from './engine/interactions';
import { synCardSelect } from './synergy-cards.service';

/** À incrémenter quand le lecteur de textes évolue : l'index est reconstruit au démarrage. */
export const INTERACTION_INDEX_VERSION = 1;
const STATE_ID = 'interactions';
const READ_BATCH = 2000;
const WRITE_BATCH = 5000;

/**
 * Index des interactions : pour chaque carte du catalogue, ses cibles "précises" (cite un
 * nom / archétype, ou filtre serré). Reconstruit après chaque sync du catalogue, au démarrage
 * si le lecteur a changé, ou à la main (`pnpm interactions:index`). ~13 000 cartes → quelques secondes.
 */
@Injectable()
export class InteractionIndexService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InteractionIndexService.name);
  private running: Promise<number> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('CARD_SYNC_ON_BOOT')) return;
    const [cards, state] = await Promise.all([this.prisma.card.count(), this.state()]);
    if (!cards || state?.databaseVersion === String(INTERACTION_INDEX_VERSION)) return;
    this.logger.log('Index des interactions absent ou périmé : reconstruction en arrière-plan…');
    void this.rebuild().catch((e) => this.logger.error(`Index des interactions : ${e}`));
  }

  state() {
    return this.prisma.syncState.findUnique({ where: { id: STATE_ID } });
  }

  /** Reconstruit tout l'index (une seule reconstruction à la fois). */
  rebuild(): Promise<number> {
    this.running ??= this.doRebuild().finally(() => (this.running = null));
    return this.running;
  }

  private async doRebuild(): Promise<number> {
    const started = Date.now();
    const rows: Prisma.CardEffectTargetCreateManyInput[] = [];
    let cursor: number | undefined;
    for (;;) {
      const batch = await this.prisma.card.findMany({
        select: synCardSelect,
        orderBy: { id: 'asc' },
        take: READ_BATCH,
        ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      });
      if (!batch.length) break;
      for (const card of batch) {
        for (const t of targetsOfCard(card, featuresOf(card))) {
          if (t.precision === 0) continue;
          const f = t.filter;
          rows.push({
            cardId: card.id,
            verb: t.verb,
            locations: t.locations,
            quoted: f.quoted,
            keys: t.keys,
            except: f.except,
            kinds: f.kinds,
            subtypes: f.subtypes,
            races: f.races,
            attributes: f.attributes,
            levelEq: f.levelEq ?? null,
            levelMin: f.levelMin ?? null,
            levelMax: f.levelMax ?? null,
            tuner: f.tuner ?? null,
            nonTuner: f.nonTuner ?? null,
            precision: t.precision,
          });
        }
      }
      cursor = batch.at(-1)!.id;
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.cardEffectTarget.deleteMany();
        for (let i = 0; i < rows.length; i += WRITE_BATCH) {
          await tx.cardEffectTarget.createMany({ data: rows.slice(i, i + WRITE_BATCH) });
        }
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    const state = {
      databaseVersion: String(INTERACTION_INDEX_VERSION),
      lastSyncAt: new Date(),
      lastStatus: 'OK',
      lastError: null,
      cardCount: rows.length,
    };
    await this.prisma.syncState.upsert({
      where: { id: STATE_ID },
      create: { id: STATE_ID, ...state },
      update: state,
    });
    this.logger.log(`Index des interactions : ${rows.length} liens en ${Date.now() - started} ms`);
    return rows.length;
  }
}
