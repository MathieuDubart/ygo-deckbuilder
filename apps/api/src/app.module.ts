import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { CatalogSyncModule } from './modules/catalog-sync/catalog-sync.module';
import { CollectionModule } from './modules/collection/collection.module';
import { DecksModule } from './modules/decks/decks.module';
import { HealthController } from './modules/health/health.controller';
import { MetaDecksModule } from './modules/meta-decks/meta-decks.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule,
    CardsModule,
    CatalogSyncModule,
    CollectionModule,
    DecksModule,
    WishlistModule,
    MetaDecksModule,
    SuggestionsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordre important : rate-limit → authentification → rôles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
