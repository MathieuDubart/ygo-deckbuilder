import { Module } from '@nestjs/common';
import { CatalogSyncModule } from '../catalog-sync/catalog-sync.module';
import { MetaDecksController } from './meta-decks.controller';
import { MetaDecksService } from './meta-decks.service';
import { MetaSyncService } from './meta-sync.service';

@Module({
  imports: [CatalogSyncModule],
  controllers: [MetaDecksController],
  providers: [MetaDecksService, MetaSyncService],
  exports: [MetaSyncService],
})
export class MetaDecksModule {}
