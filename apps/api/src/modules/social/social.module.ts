import { Module } from '@nestjs/common';
import { FriendProgressService } from './friend-progress.service';
import { FriendsService } from './friends.service';
import { ProfileService } from './profile.service';
import { SocialController } from './social.controller';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

/**
 * Profils, amitiés et ce qu'elles rendent visible. Le module exporte `FriendsService` et
 * `FriendProgressService` : d'autres modules (les extensions) ont besoin de savoir qui est ami
 * avec qui, mais jamais d'écrire une amitié.
 */
@Module({
  controllers: [SocialController, UploadsController],
  providers: [FriendsService, FriendProgressService, ProfileService, StorageService],
  exports: [FriendsService, FriendProgressService],
})
export class SocialModule {}
