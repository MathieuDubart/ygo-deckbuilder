import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { deckGuideRequestSchema, type DeckGuideRequest } from '@ygo/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DeckGuideService } from './deck-guide.service';

@Controller('suggestions')
export class SynergyController {
  constructor(private readonly guides: DeckGuideService) {}

  /** Guide de jeu d'une liste (deck généré ou deck perso) : plan, combos, erreurs à éviter. */
  @Post('guide')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  guide(@Body(new ZodValidationPipe(deckGuideRequestSchema)) body: DeckGuideRequest) {
    return this.guides.guide(body);
  }
}
