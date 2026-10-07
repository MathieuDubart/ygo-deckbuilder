import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  friendRequestSchema,
  profileCardsSchema,
  setIdsSchema,
  updateProfileSchema,
  userSearchSchema,
  type FriendRequestInput,
  type ProfileCardsInput,
  type ProfileImageKind,
  type SetIdsInput,
  type UpdateProfileInput,
  type UserSearchInput,
} from '@ygo/shared';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { t } from '../../common/i18n/locale-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FriendProgressService } from './friend-progress.service';
import { FriendsService } from './friends.service';
import { ProfileService } from './profile.service';

/** Multer garde le fichier en mémoire : il est réencodé aussitôt, rien ne touche le disque brut. */
const imageUpload = () =>
  UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
      fileFilter: (_req, file, done) => {
        // Premier tri, pas une garantie : c'est le réencodage qui tranche
        const accepted = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.mimetype);
        done(null, accepted);
      },
    }),
  );

@Controller()
export class SocialController {
  constructor(
    private readonly profile: ProfileService,
    private readonly friends: FriendsService,
    private readonly progress: FriendProgressService,
  ) {}

  // MARK: - Son propre profil

  @Get('me/profile')
  me(@CurrentUser() user: AuthUser) {
    return this.profile.mine(user.id);
  }

  @Patch('me/profile')
  @HttpCode(204)
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.profile.updateUsername(user.id, body);
  }

  @Put('me/profile/cards')
  setCards(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(profileCardsSchema)) body: ProfileCardsInput,
  ) {
    return this.profile.setCards(user.id, body.printIds);
  }

  @Post('me/profile/avatar')
  @imageUpload()
  avatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.image(user.id, 'avatar', file);
  }

  @Delete('me/profile/avatar')
  @HttpCode(204)
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.profile.removeImage(user.id, 'avatar');
  }

  @Post('me/profile/banner')
  @imageUpload()
  banner(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.image(user.id, 'banner', file);
  }

  @Delete('me/profile/banner')
  @HttpCode(204)
  removeBanner(@CurrentUser() user: AuthUser) {
    return this.profile.removeImage(user.id, 'banner');
  }

  private async image(userId: string, kind: ProfileImageKind, file?: Express.Multer.File) {
    // Pas de fichier = rien d'envoyé, ou refusé par le filtre de type
    if (!file?.buffer?.length) throw new BadRequestException(t('errors.imageUnreadable'));
    return { url: await this.profile.setImage(userId, kind, file.buffer) };
  }

  // MARK: - Profils et recherche

  @Get('users/search')
  search(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(userSearchSchema)) query: UserSearchInput,
  ) {
    return this.friends.search(user.id, query.q);
  }

  @Get('users/:username/profile')
  profileOf(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.profile.view(user.id, username);
  }

  // MARK: - Amis

  @Get('friends')
  list(@CurrentUser() user: AuthUser) {
    return this.friends.list(user.id);
  }

  @Get('friends/requests')
  requests(@CurrentUser() user: AuthUser) {
    return this.friends.requests(user.id);
  }

  @Post('friends/requests')
  request(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(friendRequestSchema)) body: FriendRequestInput,
  ) {
    return this.friends.request(user.id, body.username);
  }

  @Post('friends/requests/:id/accept')
  @HttpCode(204)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.friends.respond(user.id, id, true);
  }

  @Post('friends/requests/:id/decline')
  @HttpCode(204)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.friends.respond(user.id, id, false);
  }

  /** Retire l'ami ou annule la demande : le même bouton dans l'interface. */
  @Delete('friends/:userId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.friends.remove(user.id, userId);
  }

  // MARK: - Avancement des amis par extension

  @Get('friends/releases')
  releases(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(setIdsSchema)) query: SetIdsInput,
  ) {
    return this.progress.forSets(user.id, query.setIds);
  }

  @Get('friends/releases/:setId')
  release(@CurrentUser() user: AuthUser, @Param('setId') setId: string) {
    return this.progress.forSet(user.id, setId);
  }
}
