import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CollectionModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
