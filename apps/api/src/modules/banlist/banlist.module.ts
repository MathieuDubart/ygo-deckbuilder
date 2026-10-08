import { Module } from '@nestjs/common';
import { CatalogSyncModule } from '../catalog-sync/catalog-sync.module';
import { BanlistController } from './banlist.controller';
import { BanlistService } from './banlist.service';

@Module({
  imports: [CatalogSyncModule],
  controllers: [BanlistController],
  providers: [BanlistService],
  exports: [BanlistService],
})
export class BanlistModule {}
