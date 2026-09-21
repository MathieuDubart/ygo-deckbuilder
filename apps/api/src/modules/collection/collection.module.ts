import { Module } from '@nestjs/common';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { OwnershipService } from './ownership.service';

@Module({
  controllers: [CollectionController],
  providers: [CollectionService, OwnershipService],
  exports: [OwnershipService],
})
export class CollectionModule {}
