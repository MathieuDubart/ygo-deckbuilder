import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [CollectionModule],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
