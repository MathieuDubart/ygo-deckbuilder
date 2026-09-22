import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  importSetSchema,
  removeProductSchema,
  type ImportSetInput,
  type RemoveProductInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProductsService } from './products.service';

/** Produits de la collection (structure decks, tins…). */
@Controller('collection')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Ajoute un produit entier (cartes + trace du produit). */
  @Post('import-set')
  importSet(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(importSetSchema)) body: ImportSetInput,
  ) {
    return this.products.importSet(user.id, body);
  }

  @Get('products')
  list(@CurrentUser() user: AuthUser) {
    return this.products.list(user.id);
  }

  @Get('products/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.detail(user.id, id);
  }

  @Delete('products/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(removeProductSchema)) q: RemoveProductInput,
  ) {
    return this.products.remove(user.id, id, q.removeCards);
  }
}
