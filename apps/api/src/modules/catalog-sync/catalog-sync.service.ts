import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapCard, mapPrint, parseDate, setPrefixOf } from './ygoprodeck.mapper';
import { YgoprodeckClient } from './ygoprodeck.client';

const SYNC_ID = 'ygoprodeck';
const BATCH = 250;

export interface SyncResult {
  skipped: boolean;
  databaseVersion?: string;
  cards: number;
  prints: number;
  sets: number;
  durationMs: number;
}

@Injectable()
export class CatalogSyncService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ygo: YgoprodeckClient,
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cron = this.config.get('CARD_SYNC_CRON');
    if (!cron) return;
    const job = CronJob.from({
      cronTime: cron,
      onTick: () => void this.sync().catch((e) => this.logger.error(e)),
    });
    this.scheduler.addCronJob('catalog-sync', job);
    job.start();
    this.logger.log(`Sync catalogue planifiée : "${cron}"`);
  }

  /** Première installation : catalogue vide → on lance la sync en tâche de fond. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('CARD_SYNC_ON_BOOT')) return;
    const count = await this.prisma.card.count();
    if (count > 0) return;
    this.logger.log('Catalogue vide : synchronisation initiale lancée en arrière-plan…');
    void this.sync().catch((e) => this.logger.error(`Sync initiale échouée : ${e}`));
  }

  status() {
    return this.prisma.syncState.findUnique({ where: { id: SYNC_ID } });
  }

  /** Synchronise tout le catalogue. Idempotent : ne fait rien si la version YGOPRODeck n'a pas bougé. */
  async sync({ force = false } = {}): Promise<SyncResult> {
    if (this.running) throw new Error('Une synchronisation est déjà en cours');
    this.running = true;
    const started = Date.now();
    try {
      const remote = await this.ygo.dbVersion();
      const local = await this.status();
      if (!force && remote && local?.databaseVersion === remote.database_version) {
        this.logger.log(`Catalogue déjà à jour (v${remote.database_version})`);
        return { skipped: true, cards: 0, prints: 0, sets: 0, durationMs: Date.now() - started };
      }

      this.logger.log('Téléchargement du catalogue YGOPRODeck (EN + FR)…');
      const [cards, cardsFr, sets] = await Promise.all([
        this.ygo.allCards(),
        this.ygo.allCards('fr').catch((e) => {
          this.logger.warn(`Traductions FR indisponibles : ${e}`);
          return [];
        }),
        this.ygo.allSets(),
      ]);
      const fr = new Map(cardsFr.map((c) => [c.id, { name: c.name, desc: c.desc }]));

      const setIds = await this.upsertSets(sets, cards);
      const cardCount = await this.upsertCards(cards.map((c) => mapCard(c, fr.get(c.id))));
      const printCount = await this.upsertPrints(cards, setIds);
      await this.refreshSearchIndex();

      const result: SyncResult = {
        skipped: false,
        databaseVersion: remote?.database_version,
        cards: cardCount,
        prints: printCount,
        sets: setIds.size,
        durationMs: Date.now() - started,
      };
      await this.saveState({ ...result, status: 'OK' });
      this.logger.log(
        `Sync OK : ${result.cards} cartes, ${result.prints} impressions, ${result.sets} sets en ${Math.round(result.durationMs / 1000)}s`,
      );
      return result;
    } catch (e) {
      await this.saveState({ status: 'ERROR', error: String(e) });
      throw e;
    } finally {
      this.running = false;
    }
  }

  private async upsertSets(
    sets: Awaited<ReturnType<YgoprodeckClient['allSets']>>,
    cards: Awaited<ReturnType<YgoprodeckClient['allCards']>>,
  ): Promise<Map<string, string>> {
    const byName = new Map(
      sets.map((s) => [
        s.set_name,
        {
          name: s.set_name,
          code: s.set_code || null,
          cardCount: s.num_of_cards ?? null,
          tcgDate: parseDate(s.tcg_date),
          imageUrl: s.set_image ?? null,
        },
      ]),
    );
    // Sets référencés par des cartes mais absents de cardsets.php
    for (const c of cards) {
      for (const s of c.card_sets ?? []) {
        if (!byName.has(s.set_name)) {
          byName.set(s.set_name, {
            name: s.set_name,
            code: setPrefixOf(s.set_code),
            cardCount: null,
            tcgDate: null,
            imageUrl: null,
          });
        }
      }
    }

    const all = [...byName.values()];
    for (let i = 0; i < all.length; i += BATCH) {
      await this.prisma.$transaction(
        all
          .slice(i, i + BATCH)
          .map((s) =>
            this.prisma.cardSet.upsert({ where: { name: s.name }, create: s, update: s }),
          ),
      );
    }
    const rows = await this.prisma.cardSet.findMany({ select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.name, r.id]));
  }

  private async upsertCards(cards: ReturnType<typeof mapCard>[]): Promise<number> {
    for (let i = 0; i < cards.length; i += BATCH) {
      await this.prisma.$transaction(
        cards
          .slice(i, i + BATCH)
          .map(({ id, ...data }) =>
            this.prisma.card.upsert({ where: { id }, create: { id, ...data }, update: data }),
          ),
      );
      if ((i / BATCH) % 10 === 0) this.logger.log(`  cartes ${i}/${cards.length}`);
    }
    return cards.length;
  }

  private async upsertPrints(
    cards: Awaited<ReturnType<YgoprodeckClient['allCards']>>,
    setIds: Map<string, string>,
  ): Promise<number> {
    const prints = cards.flatMap((c) =>
      (c.card_sets ?? []).flatMap((s) => {
        const setId = setIds.get(s.set_name);
        return setId ? [{ ...mapPrint(c.id, s), setId }] : [];
      }),
    );
    for (let i = 0; i < prints.length; i += BATCH) {
      await this.prisma.$transaction(
        prints.slice(i, i + BATCH).map((p) =>
          this.prisma.cardPrint.upsert({
            where: {
              cardId_printCode_rarity: {
                cardId: p.cardId,
                printCode: p.printCode,
                rarity: p.rarity,
              },
            },
            create: p,
            update: { price: p.price, rarityCode: p.rarityCode, setId: p.setId },
          }),
        ),
      );
    }
    return prints.length;
  }

  /** Recalcule le texte de recherche normalisé (fonction SQL ygo_normalize, cf. migration "search"). */
  private async refreshSearchIndex(): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "Card" SET "searchText" = ygo_normalize(concat_ws(' ', "nameFr", "name", "archetype"))`;
    await this.prisma.$executeRaw`
      UPDATE "CardSet" SET "searchText" = ygo_normalize(concat_ws(' ', "name", "code"))`;
  }

  private async saveState(s: {
    status: string;
    error?: string;
    databaseVersion?: string;
    cards?: number;
  }) {
    const data = {
      lastSyncAt: new Date(),
      lastStatus: s.status,
      lastError: s.error ?? null,
      ...(s.databaseVersion && { databaseVersion: s.databaseVersion }),
      ...(s.cards && { cardCount: s.cards }),
    };
    await this.prisma.syncState.upsert({
      where: { id: SYNC_ID },
      create: { id: SYNC_ID, ...data },
      update: data,
    });
  }
}
