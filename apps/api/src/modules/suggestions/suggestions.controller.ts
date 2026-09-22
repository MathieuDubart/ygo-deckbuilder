import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  generateFromArchetypeSchema,
  generateFromMetaSchema,
  metaSuggestionQuerySchema,
  type GenerateFromArchetypeInput,
  type GenerateFromMetaInput,
  type MetaSuggestionQuery,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DeckGeneratorService } from './deck-generator.service';
import { SuggestionsService } from './suggestions.service';

@Controller('suggestions')
export class SuggestionsController {
  constructor(
    private readonly suggestions: SuggestionsService,
    private readonly generator: DeckGeneratorService,
  ) {}

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

  /** Decks complets et jouables montables avec la collection, du plus solide au moins solide. */
  @Get('playable')
  playable(@CurrentUser() user: AuthUser) {
    return this.generator.playable(user.id);
  }

  /** Aperçu d'un deck généré depuis un archétype du meta (rien n'est enregistré). */
  @Get('generate/meta/:metaDeckId')
  generateFromMeta(
    @CurrentUser() user: AuthUser,
    @Param('metaDeckId') metaDeckId: string,
    @Query(new ZodValidationPipe(generateFromMetaSchema)) q: GenerateFromMetaInput,
  ) {
    return this.generator.fromMeta(user.id, metaDeckId, q.mode);
  }

  /** Aperçu d'un deck généré depuis un archétype de la collection. */
  @Get('generate/archetype')
  generateFromArchetype(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(generateFromArchetypeSchema)) q: GenerateFromArchetypeInput,
  ) {
    return this.generator.fromArchetype(user.id, q.archetype);
  }
}
