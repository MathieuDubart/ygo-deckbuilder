import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  importSetSchema,
  ownedProductsQuerySchema,
  rebuildProductDecksSchema,
  removeProductSchema,
  type ImportSetInput,
  type OwnedProductsQueryInput,
  type RebuildProductDecksInput,
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
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ownedProductsQuerySchema)) q: OwnedProductsQueryInput,
  ) {
    return this.products.list(user.id, q);
  }

  @Get('products/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.detail(user.id, id);
  }

  /** Repose les decks officiels du produit — celui qu'on a supprimé par erreur revient. */
  @Post('products/:id/decks')
  rebuildDecks(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rebuildProductDecksSchema)) body: RebuildProductDecksInput,
  ) {
    return this.products.rebuildDecks(user.id, id, body.force);
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
