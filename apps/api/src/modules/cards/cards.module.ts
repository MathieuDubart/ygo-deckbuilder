import { Module } from '@nestjs/common';
import { CatalogSyncModule } from '../catalog-sync/catalog-sync.module';
import { CollectionModule } from '../collection/collection.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { PrintLookupService } from './print-lookup.service';

@Module({
  imports: [CollectionModule, CatalogSyncModule],
  controllers: [CardsController],
  providers: [CardsService, PrintLookupService],
})
export class CardsModule {}
