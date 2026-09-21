import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  addWishlistItemSchema,
  updateWishlistItemSchema,
  type AddWishlistItemInput,
  type UpdateWishlistItemInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.wishlist.list(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addWishlistItemSchema)) body: AddWishlistItemInput,
  ) {
    return this.wishlist.add(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWishlistItemSchema)) body: UpdateWishlistItemInput,
  ) {
    return this.wishlist.update(user.id, id, body);
  }

  @Post(':id/acquired')
  @HttpCode(204)
  acquired(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wishlist.markAcquired(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wishlist.remove(user.id, id);
  }
}
