import { Module } from '@nestjs/common';
import { YugipediaClient } from '../catalog-sync/yugipedia.client';
import { CollectionModule } from '../collection/collection.module';
import { ProductContentService } from './product-content.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/** Produits possédés : import, contenu officiel (quantités), reconstitution. */
@Module({
  imports: [CollectionModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductContentService, YugipediaClient],
})
export class ProductsModule {}
