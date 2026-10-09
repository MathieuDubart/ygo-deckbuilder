import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  addCollectionItemSchema,
  CARD_LANGUAGES,
  collectionLanguageSchema,
  collectionQuerySchema,
  updateCollectionItemSchema,
  type AddCollectionItemInput,
  type CardLanguage,
  type CollectionLanguageInput,
  type CollectionQueryInput,
  type UpdateCollectionItemInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { localeLanguage } from '../../common/catalog/collection-language';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CollectionService } from './collection.service';

@Controller('collection')
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(collectionQuerySchema)) q: CollectionQueryInput,
  ) {
    return this.collection.list(user.id, q);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.collection.stats(user.id);
  }

  /** Valeurs de filtre présentes dans la collection, avec leur effectif. */
  @Get('facets')
  facets(@CurrentUser() user: AuthUser) {
    return this.collection.facets(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addCollectionItemSchema)) body: AddCollectionItemInput,
  ) {
    return this.collection.add(user.id, body);
  }

  /**
   * Réglage de langue + aperçu de la normalisation. `target` permet de demander l'aperçu
   * d'une langue qu'on envisage sans l'avoir encore choisie.
   */
  @Get('language')
  language(@CurrentUser() user: AuthUser, @Query('target') target?: string) {
    const asLanguage = (value: string | undefined): CardLanguage | undefined =>
      CARD_LANGUAGES.find((l) => l === value?.toUpperCase());
    // Jamais choisie → la langue de la requête fait un repli raisonnable, mais on garde la
    // distinction : `language` reste null tant que personne n'a tranché.
    return this.collection.languageState(user.id, asLanguage(target), localeLanguage());
  }

  @Put('language')
  setLanguage(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(collectionLanguageSchema)) body: CollectionLanguageInput,
  ) {
    return this.collection.setLanguage(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCollectionItemSchema)) body: UpdateCollectionItemInput,
  ) {
    return this.collection.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.collection.remove(user.id, id);
  }
}
