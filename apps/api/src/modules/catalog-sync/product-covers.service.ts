import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isValidTitle } from './yugipedia.parser';
import { YugipediaClient } from './yugipedia.client';

/** Un produit sans visuel trouvé est retenté après ce délai (la page a pu être créée depuis). */
const RETRY_AFTER_DAYS = 30;

/**
 * Récupère les visuels HD des produits sur Yugipedia et les stocke (CardSet.coverUrl).
 * Tourne en tâche de fond : au démarrage s'il reste des produits à traiter, et après chaque sync.
 */
@Injectable()
export class ProductCoversService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductCoversService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly yugipedia: YugipediaClient,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('PRODUCT_COVERS_ENABLED')) return;
    this.refreshInBackground();
  }

  refreshInBackground(): void {
    void this.refresh().catch((e) => this.logger.warn(`Visuels produits : ${e}`));
  }

  async refresh(): Promise<{ checked: number; found: number }> {
    if (this.running) return { checked: 0, found: 0 };
    this.running = true;
    try {
      const retryBefore = new Date(Date.now() - RETRY_AFTER_DAYS * 24 * 3600 * 1000);
      const pending = await this.prisma.cardSet.findMany({
        where: {
          prints: { some: {} }, // seulement les produits réellement proposés
          OR: [{ coverCheckedAt: null }, { coverUrl: null, coverCheckedAt: { lt: retryBefore } }],
        },
        select: { id: true, name: true },
        orderBy: { tcgDate: { sort: 'desc', nulls: 'last' } }, // les récents d'abord
      });
      if (!pending.length) return { checked: 0, found: 0 };
      this.logger.log(`Recherche des visuels HD pour ${pending.length} produits (Yugipedia)…`);

      let found = 0;
      for (let i = 0; i < pending.length; i += YugipediaClient.BATCH) {
        const batch = pending.slice(i, i + YugipediaClient.BATCH);
        const titles = batch.map((s) => s.name).filter(isValidTitle);
        const images = titles.length ? await this.yugipedia.pageImages(titles) : new Map();
        const now = new Date();

        await this.prisma.$transaction(
          batch.map((s) => {
            const url = images.get(s.name) ?? null;
            if (url) found++;
            return this.prisma.cardSet.update({
              where: { id: s.id },
              // On ne remplace jamais un visuel déjà trouvé par "rien"
              data: { coverCheckedAt: now, ...(url && { coverUrl: url }) },
            });
          }),
        );
        await sleep(1000);
      }
      this.logger.log(`Visuels HD : ${found}/${pending.length} trouvés`);
      return { checked: pending.length, found };
    } finally {
      this.running = false;
    }
  }
}
