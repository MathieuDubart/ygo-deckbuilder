import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  addCollectionItemSchema,
  collectionQuerySchema,
  updateCollectionItemSchema,
  type AddCollectionItemInput,
  type CollectionQueryInput,
  type UpdateCollectionItemInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
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

  @Post()
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addCollectionItemSchema)) body: AddCollectionItemInput,
  ) {
    return this.collection.add(user.id, body);
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
