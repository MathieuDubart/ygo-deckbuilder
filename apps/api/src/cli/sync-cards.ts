/**
 * Sync du catalogue en ligne de commande :
 *   pnpm cards:sync           → ne fait rien si déjà à jour
 *   pnpm cards:sync --force   → resynchronise tout
 */
import './quiet';
import 'dotenv/config';
import { CatalogSyncService } from '../modules/catalog-sync/catalog-sync.service';
import { ProductCoversService } from '../modules/catalog-sync/product-covers.service';
import { onError, runTask } from './run';

runTask(async (app) => {
  const result = await app
    .get(CatalogSyncService)
    .sync({ force: process.argv.includes('--force') });
  const covers = await app
    .get(ProductCoversService)
    .refresh()
    .catch((e) => `échec : ${e}`);
  return { ...result, covers };
}).catch(onError);
