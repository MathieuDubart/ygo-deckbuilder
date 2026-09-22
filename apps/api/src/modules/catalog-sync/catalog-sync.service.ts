import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapCard, mapPrint, parseDate, setPrefixOf } from './ygoprodeck.mapper';
import { InteractionIndexService } from '../synergy/interaction-index.service';
import { ProductCoversService } from './product-covers.service';
import { YgoprodeckClient } from './ygoprodeck.client';
import { t } from '../../common/i18n/locale-context';

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
    private readonly covers: ProductCoversService,
    private readonly interactions: InteractionIndexService,
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
    if (count > 0) {
      // Mise à jour d'une installation existante : traductions DE / IT / PT pas encore là
      if (!(await this.prisma.cardTranslation.count())) {
        this.logger.log(
          'Traductions des cartes (DE, IT, PT) absentes : récupération en arrière-plan…',
        );
        void this.syncTranslations().catch((e) => this.logger.error(`Traductions : ${e}`));
      }
      return;
    }
    this.logger.log('Catalogue vide : synchronisation initiale lancée en arrière-plan…');
    void this.sync().catch((e) => this.logger.error(`Sync initiale échouée : ${e}`));
  }

  status() {
    return this.prisma.syncState.findUnique({ where: { id: SYNC_ID } });
  }

  /** Synchronise tout le catalogue. Idempotent : ne fait rien si la version YGOPRODeck n'a pas bougé. */
  async sync({ force = false } = {}): Promise<SyncResult> {
    if (this.running) throw new Error(t('errors.syncRunning'));
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
      await this.upsertArts(cards);
      await this.upsertTranslations();
      await this.refreshSearchIndex();
      // Nouveaux textes → nouvelles interactions (un échec ici ne fait pas échouer la sync)
      await this.interactions
        .rebuild()
        .catch((e) => this.logger.warn(`Index des interactions non reconstruit : ${e}`));

      const result: SyncResult = {
        skipped: false,
        databaseVersion: remote?.database_version,
        cards: cardCount,
        prints: printCount,
        sets: setIds.size,
        durationMs: Date.now() - started,
      };
      await this.saveState({ ...result, status: 'OK' });
      // Nouveaux produits → visuels HD en arrière-plan (ne bloque pas la sync)
      if (this.config.get('PRODUCT_COVERS_ENABLED')) this.covers.refreshInBackground();
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

  /** Artworks alternatifs → carte principale (utilisé par les imports .ydk et listes de tournoi). */
  private async upsertArts(
    cards: Awaited<ReturnType<YgoprodeckClient['allCards']>>,
  ): Promise<void> {
    const arts = cards.flatMap((c) =>
      (c.card_images ?? []).filter((i) => i.id !== c.id).map((i) => ({ id: i.id, cardId: c.id })),
    );
    await this.prisma.cardArt.deleteMany();
    for (let i = 0; i < arts.length; i += 1000) {
      await this.prisma.cardArt.createMany({ data: arts.slice(i, i + 1000), skipDuplicates: true });
    }
  }

  /** Recalcule le texte de recherche normalisé (fonction SQL ygo_normalize, cf. migration "search"). */
  /** Traductions seules (installation existante, ou appel manuel), puis index de recherche. */
  async syncTranslations(): Promise<number> {
    const n = await this.upsertTranslations();
    await this.refreshSearchIndex();
    return n;
  }

  /**
   * Noms / textes allemands, italiens et portugais (le français est dans Card.nameFr/descFr).
   * Une langue indisponible n'empêche pas les autres.
   */
  private async upsertTranslations(): Promise<number> {
    const known = new Set(
      (await this.prisma.card.findMany({ select: { id: true } })).map((c) => c.id),
    );
    let total = 0;
    for (const locale of ['de', 'it', 'pt'] as const) {
      try {
        const cards = await this.ygo.allCards(locale);
        const rows = cards
          .filter((c) => known.has(c.id) && c.name)
          .map((c) => ({ cardId: c.id, locale, name: c.name, desc: c.desc ?? '' }));
        await this.prisma.$transaction(
          async (tx) => {
            await tx.cardTranslation.deleteMany({ where: { locale } });
            for (let i = 0; i < rows.length; i += 5000) {
              await tx.cardTranslation.createMany({ data: rows.slice(i, i + 5000) });
            }
          },
          { timeout: 300_000, maxWait: 30_000 },
        );
        total += rows.length;
        this.logger.log(`  traductions ${locale.toUpperCase()} : ${rows.length} cartes`);
      } catch (e) {
        this.logger.warn(`Traductions ${locale.toUpperCase()} indisponibles : ${e}`);
      }
    }
    return total;
  }

  private async refreshSearchIndex(): Promise<void> {
    // Tous les noms connus (EN, FR, DE, IT, PT) + archétype : on retrouve une carte dans sa langue
    await this.prisma.$executeRaw`
      UPDATE "Card" c SET "searchText" = ygo_normalize(concat_ws(' ', c."nameFr", c."name", c."archetype",
        (SELECT string_agg(tr.name, ' ') FROM "CardTranslation" tr WHERE tr."cardId" = c.id)))`;
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
