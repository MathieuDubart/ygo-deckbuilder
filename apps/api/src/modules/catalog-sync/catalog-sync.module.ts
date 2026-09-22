import { Module } from '@nestjs/common';
import { CatalogSyncController } from './catalog-sync.controller';
import { CatalogSyncService } from './catalog-sync.service';
import { ProductCoversService } from './product-covers.service';
import { YgoprodeckClient } from './ygoprodeck.client';
import { YugipediaClient } from './yugipedia.client';

@Module({
  controllers: [CatalogSyncController],
  providers: [CatalogSyncService, YgoprodeckClient, YugipediaClient, ProductCoversService],
  exports: [CatalogSyncService, ProductCoversService, YgoprodeckClient],
})
export class CatalogSyncModule {}
