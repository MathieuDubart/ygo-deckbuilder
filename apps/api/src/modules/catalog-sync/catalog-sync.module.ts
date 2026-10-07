import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { SynergyModule } from '../synergy/synergy.module';
import { CatalogSyncController } from './catalog-sync.controller';
import { CatalogSyncService } from './catalog-sync.service';
import { ProductCoversService } from './product-covers.service';
import { UpcomingSetsService } from './upcoming-sets.service';
import { YgoprodeckClient } from './ygoprodeck.client';
import { YugipediaClient } from './yugipedia.client';

@Module({
  imports: [SynergyModule, CollectionModule],
  controllers: [CatalogSyncController],
  providers: [
    CatalogSyncService,
    YgoprodeckClient,
    YugipediaClient,
    ProductCoversService,
    UpcomingSetsService,
  ],
  exports: [CatalogSyncService, ProductCoversService, UpcomingSetsService, YgoprodeckClient],
})
export class CatalogSyncModule {}
