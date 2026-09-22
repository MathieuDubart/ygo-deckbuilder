import { Global, Module } from '@nestjs/common';
import { CardResolver } from './card-resolver.service';

@Global()
@Module({ providers: [CardResolver], exports: [CardResolver] })
export class CatalogCommonModule {}
