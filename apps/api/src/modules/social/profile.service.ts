import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MAX_PROFILE_CARDS,
  type ProfileCardDto,
  type ProfileImageKind,
  type ProfileViewDto,
  type UpdateProfileInput,
} from '@ygo/shared';
import { t } from '../../common/i18n/locale-context';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { canSeeProfile } from './friendship';
import { FriendsService, publicUserSelect, toPublicUser } from './friends.service';
import { profileCards, type ProfileCardRow } from './social.sql';
import { StorageService } from './storage.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    private readonly storage: StorageService,
  ) {}

  /** Son propre profil. Le pseudo n'est pas dans le jeton (il peut changer), donc on le lit. */
  async mine(userId: string): Promise<ProfileViewDto> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true },
    });
    return this.view(userId, me.username);
  }

  /**
   * Profil vu par `viewerId`. Hors amitié, on ne renvoie que le strict nécessaire pour
   * envoyer une demande : c'est le choix de visibilité du projet, et il est tenu ici, pas
   * dans l'interface.
   */
  async view(viewerId: string, username: string): Promise<ProfileViewDto> {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { ...publicUserSelect, createdAt: true },
    });
    if (!user) throw new NotFoundException(t('errors.userNotFound'));

    const relation = await this.friends.relation(viewerId, user.id);
    if (!canSeeProfile(relation)) {
      return { visible: false, user: toPublicUser(user), ...relation };
    }

    const [stats, cards, friendCount, friendsSince] = await Promise.all([
      this.friends.stats([user.id]),
      this.cards(user.id),
      this.prisma.friendship.count({
        where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      }),
      this.friendsSince(viewerId, user.id),
    ]);

    return {
      visible: true,
      user: toPublicUser(user),
      state: relation.state,
      friendsSince,
      friendCount,
      stats: stats.get(user.id) ?? { distinctCards: 0, copies: 0, sets: 0, completedSets: 0 },
      cards,
      memberSince: user.createdAt.toISOString(),
    };
  }

  private async friendsSince(viewerId: string, otherId: string): Promise<string | null> {
    if (viewerId === otherId) return null;
    const row = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: viewerId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: viewerId },
        ],
      },
      select: { respondedAt: true, createdAt: true },
    });
    if (!row) return null;
    return (row.respondedAt ?? row.createdAt).toISOString();
  }

  /** Cartes mises en avant, dans l'ordre choisi, limitées à celles encore possédées. */
  async cards(userId: string): Promise<ProfileCardDto[]> {
    const rows = await this.prisma.$queryRaw<ProfileCardRow[]>(profileCards(userId));
    if (rows.length === 0) return [];

    const cards = await this.prisma.card.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.cardId))] } },
      select: cardSummarySelect,
    });
    const byId = new Map(cards.map((card) => [card.id, card]));

    return rows.flatMap((row) => {
      const card = byId.get(row.cardId);
      if (!card) return [];
      return [
        {
          printId: row.printId,
          printCode: row.printCode,
          rarity: row.rarity,
          setName: row.setName,
          card: toCardSummary(card),
        },
      ];
    });
  }

  async updateUsername(userId: string, input: UpdateProfileInput): Promise<void> {
    if (!input.username) return;
    const clash = await this.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: 'insensitive' }, id: { not: userId } },
      select: { id: true },
    });
    if (clash) throw new ConflictException(t('errors.usernameTaken'));
    await this.prisma.user.update({ where: { id: userId }, data: { username: input.username } });
  }

  /**
   * Remplace la liste des cartes mises en avant. On exige la possession de **chaque**
   * impression : le profil ne doit pas pouvoir exposer une carte qu'on n'a pas, même par une
   * requête forgée à la main.
   */
  async setCards(userId: string, printIds: string[]): Promise<ProfileCardDto[]> {
    const unique = [...new Set(printIds)].slice(0, MAX_PROFILE_CARDS);

    if (unique.length > 0) {
      const owned = await this.prisma.collectionItem.findMany({
        where: { userId, printId: { in: unique } },
        select: { printId: true },
        distinct: ['printId'],
      });
      const ownedIds = new Set(owned.map((row) => row.printId));
      if (unique.some((id) => !ownedIds.has(id))) {
        throw new BadRequestException(t('errors.printNotOwned'));
      }
    }

    await this.prisma.$transaction([
      this.prisma.profileCard.deleteMany({ where: { userId } }),
      ...(unique.length > 0
        ? [
            this.prisma.profileCard.createMany({
              data: unique.map((printId, index) => ({ userId, printId, position: index })),
            }),
          ]
        : []),
    ]);
    return this.cards(userId);
  }

  /** Enregistre l'image et supprime la précédente : un avatar remplacé ne laisse pas de fichier. */
  async setImage(userId: string, kind: ProfileImageKind, file: Buffer): Promise<string> {
    const previous = await this.imagePath(userId, kind);
    const path = await this.storage.saveProfileImage(kind, userId, file);
    await this.prisma.user.update({ where: { id: userId }, data: this.imageData(kind, path) });
    await this.storage.remove(previous);
    return `/uploads/${path}`;
  }

  async removeImage(userId: string, kind: ProfileImageKind): Promise<void> {
    const previous = await this.imagePath(userId, kind);
    await this.prisma.user.update({ where: { id: userId }, data: this.imageData(kind, null) });
    await this.storage.remove(previous);
  }

  private async imagePath(userId: string, kind: ProfileImageKind): Promise<string | null> {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarPath: true, bannerPath: true },
    });
    return kind === 'avatar' ? row.avatarPath : row.bannerPath;
  }

  private imageData(kind: ProfileImageKind, path: string | null) {
    return kind === 'avatar' ? { avatarPath: path } : { bannerPath: path };
  }
}
