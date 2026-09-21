import { Module } from '@nestjs/common';
import { CatalogSyncController } from './catalog-sync.controller';
import { CatalogSyncService } from './catalog-sync.service';
import { YgoprodeckClient } from './ygoprodeck.client';

@Module({
  controllers: [CatalogSyncController],
  providers: [CatalogSyncService, YgoprodeckClient],
  exports: [CatalogSyncService],
})
export class CatalogSyncModule {}
