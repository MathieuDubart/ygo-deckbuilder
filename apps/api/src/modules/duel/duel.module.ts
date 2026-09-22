import { Module } from '@nestjs/common';
import { DuelDataService } from './data/duel-data.service';
import { DuelController } from './duel.controller';
import { DuelService } from './duel.service';

/** Simulateur de duel (moteur EDOPro en WebAssembly + scripts de cartes ProjectIgnis). */
@Module({
  controllers: [DuelController],
  providers: [DuelDataService, DuelService],
})
export class DuelModule {}
