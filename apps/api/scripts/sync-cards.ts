/**
 * Sync du catalogue en ligne de commande (première install, ou à la main) :
 *   pnpm cards:sync           → ne fait rien si déjà à jour
 *   pnpm cards:sync --force   → resynchronise tout
 */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CatalogSyncService } from '../src/modules/catalog-sync/catalog-sync.service';

async function main() {
  process.env.CARD_SYNC_CRON = ''; // pas de cron pour un run one-shot
  process.env.CARD_SYNC_ON_BOOT = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app
      .get(CatalogSyncService)
      .sync({ force: process.argv.includes('--force') });
    console.log(result);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
