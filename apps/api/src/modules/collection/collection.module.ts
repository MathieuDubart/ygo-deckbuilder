import { Module } from '@nestjs/common';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { OwnershipService } from './ownership.service';
import { SetProgressService } from './set-progress.service';

@Module({
  controllers: [CollectionController],
  providers: [CollectionService, OwnershipService, SetProgressService],
  exports: [OwnershipService, SetProgressService],
})
export class CollectionModule {}
