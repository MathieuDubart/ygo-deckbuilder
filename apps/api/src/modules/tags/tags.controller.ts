import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  createTagSchema,
  updateTagSchema,
  type CreateTagInput,
  type UpdateTagInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tags.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTagSchema)) body: CreateTagInput,
  ) {
    return this.tags.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTagSchema)) body: UpdateTagInput,
  ) {
    return this.tags.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tags.remove(user.id, id);
  }

  // Pose et retrait : PUT/DELETE sur la cible, donc rejouables sans effet de bord.

  @Put(':id/cards/:cardId')
  tagCard(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('cardId', ParseIntPipe) cardId: number,
  ) {
    return this.tags.setCard(user.id, id, cardId, true);
  }

  @Delete(':id/cards/:cardId')
  untagCard(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('cardId', ParseIntPipe) cardId: number,
  ) {
    return this.tags.setCard(user.id, id, cardId, false);
  }

  @Put(':id/sets/:setId')
  tagSet(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('setId') setId: string) {
    return this.tags.setSet(user.id, id, setId, true);
  }

  @Delete(':id/sets/:setId')
  untagSet(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('setId') setId: string) {
    return this.tags.setSet(user.id, id, setId, false);
  }

  @Put(':id/decks/:deckId')
  tagDeck(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('deckId') deckId: string) {
    return this.tags.setDeck(user.id, id, deckId, true);
  }

  @Delete(':id/decks/:deckId')
  untagDeck(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('deckId') deckId: string,
  ) {
    return this.tags.setDeck(user.id, id, deckId, false);
  }
}
