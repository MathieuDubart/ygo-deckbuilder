import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PRODUCT_KIND } from '../../common/catalog/product-sql';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { ProductContentService } from './product-content.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Récupère en arrière-plan les decks officiels de tous les produits-decks du catalogue
 * (structure decks, starters, coffrets de decks) : ce sont eux que les suggestions comparent
 * à la collection. Seuls les produits jamais lus (ou sans liste depuis une semaine) sont
 * traités ; au premier démarrage il y en a quelques centaines, ~1 par seconde.
 */
@Injectable()
export class OfficialDecksService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(OfficialDecksService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ProductContentService,
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) return;
    // Tous les jours à 6h : nouveaux produits du catalogue, listes Yugipedia complétées
    const job = CronJob.from({
      cronTime: '0 6 * * *',
      onTick: () => void this.refresh().catch((e) => this.logger.error(e)),
    });
    this.scheduler.addCronJob('official-decks', job);
    job.start();
  }

  onApplicationBootstrap(): void {
    if (!this.enabled || !this.config.get('CARD_SYNC_ON_BOOT')) return;
    // Laisse la sync du catalogue démarrer d'abord (catalogue vide au 1er lancement)
    setTimeout(() => void this.refresh().catch((e) => this.logger.error(e)), 30_000);
  }

  private get enabled() {
    return this.config.get('PRODUCT_COVERS_ENABLED');
  }

  async refresh(): Promise<{ checked: number; decks: number }> {
    if (this.running) return { checked: 0, decks: 0 };
    this.running = true;
    try {
      const retryBefore = new Date(Date.now() - 7 * 86_400_000);
      const pending = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM "CardSet" s
        WHERE EXISTS (SELECT 1 FROM "CardPrint" p WHERE p."setId" = s.id)
          AND (${PRODUCT_KIND} IN ('STRUCTURE', 'STARTER', 'BOX') OR s."searchText" ~ '(^| )decks?( |$)')
          AND (s."contentCheckedAt" IS NULL
               OR (s."contentSource" IS NULL AND s."contentCheckedAt" < ${retryBefore}))
        ORDER BY s."tcgDate" DESC NULLS LAST`;
      if (!pending.length) return { checked: 0, decks: 0 };
      this.logger.log(`Decks officiels : lecture de ${pending.length} produits (Yugipedia)…`);
      for (const { id } of pending) {
        await this.content.ensure(id).catch(() => false);
        await sleep(1000);
      }
      const decks = await this.prisma.productDeck.count();
      this.logger.log(`Decks officiels : ${decks} decks connus`);
      return { checked: pending.length, decks };
    } finally {
      this.running = false;
    }
  }
}
