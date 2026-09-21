import { Controller, Get, Param, Query } from '@nestjs/common';
import { metaSuggestionQuerySchema, type MetaSuggestionQuery } from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SuggestionsService } from './suggestions.service';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get('meta-decks')
  metaDecks(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(metaSuggestionQuerySchema)) q: MetaSuggestionQuery,
  ) {
    return this.suggestions.metaDecks(user.id, q);
  }

  @Get('archetypes')
  archetypes(@CurrentUser() user: AuthUser) {
    return this.suggestions.archetypes(user.id);
  }

  @Get('decks/:deckId/cards')
  forDeck(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string) {
    return this.suggestions.forDeck(user.id, deckId);
  }
}
