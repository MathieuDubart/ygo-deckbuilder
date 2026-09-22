import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { AiGuideService } from './ai-guide.service';
import { DeckGuideService } from './deck-guide.service';
import { InteractionIndexService } from './interaction-index.service';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { SynergyCardsService } from './synergy-cards.service';
import { SynergyController } from './synergy.controller';

/** Lecture des effets, graphe de synergie, combos, guides de jeu et interactions entre cartes. */
@Module({
  imports: [CollectionModule],
  controllers: [SynergyController, InteractionsController],
  providers: [
    SynergyCardsService,
    DeckGuideService,
    AiGuideService,
    InteractionIndexService,
    InteractionsService,
  ],
  exports: [SynergyCardsService, InteractionIndexService],
})
export class SynergyModule {}
