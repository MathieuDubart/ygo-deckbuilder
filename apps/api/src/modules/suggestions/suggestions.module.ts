import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { SynergyModule } from '../synergy/synergy.module';
import { SuggestionsController } from './suggestions.controller';
import { DeckGeneratorService } from './deck-generator.service';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [CollectionModule, SynergyModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService, DeckGeneratorService],
})
export class SuggestionsModule {}
