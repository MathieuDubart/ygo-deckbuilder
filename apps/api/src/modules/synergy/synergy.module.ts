import { Module } from '@nestjs/common';
import { AiGuideService } from './ai-guide.service';
import { DeckGuideService } from './deck-guide.service';
import { SynergyCardsService } from './synergy-cards.service';
import { SynergyController } from './synergy.controller';

/** Lecture des effets, graphe de synergie, combos et guides de jeu. */
@Module({
  controllers: [SynergyController],
  providers: [SynergyCardsService, DeckGuideService, AiGuideService],
  exports: [SynergyCardsService],
})
export class SynergyModule {}
