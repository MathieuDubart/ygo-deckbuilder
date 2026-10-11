import { Module } from '@nestjs/common';
import { BanlistModule } from '../banlist/banlist.module';
import { CatalogSyncModule } from '../catalog-sync/catalog-sync.module';
import { MetaDecksModule } from '../meta-decks/meta-decks.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Panneau d'administration : lecture de l'instance, rôles, relance des synchros. */
@Module({
  imports: [CatalogSyncModule, BanlistModule, MetaDecksModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
