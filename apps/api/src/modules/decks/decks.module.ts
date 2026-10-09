import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { SynergyModule } from '../synergy/synergy.module';
import { DecksController } from './decks.controller';
import { DeckStrengthService } from './deck-strength.service';
import { DecksService } from './decks.service';

@Module({
  imports: [CollectionModule, SynergyModule],
  controllers: [DecksController],
  providers: [DecksService, DeckStrengthService],
  exports: [DeckStrengthService],
})
export class DecksModule {}
