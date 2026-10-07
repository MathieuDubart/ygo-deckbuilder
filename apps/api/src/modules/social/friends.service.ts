import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  FriendDto,
  FriendRequestDto,
  PublicUserDto,
  SocialStatsDto,
  UserSearchResultDto,
} from '@ygo/shared';
import { t } from '../../common/i18n/locale-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { otherSide, relationTo, type FriendshipRow } from './friendship';
import { socialStats, type SocialStatsRow } from './social.sql';

/** Limite de la recherche : de quoi choisir sans transformer la page en annuaire. */
const SEARCH_LIMIT = 20;

export const publicUserSelect = {
  id: true,
  username: true,
  avatarPath: true,
  bannerPath: true,
} satisfies Prisma.UserSelect;

type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/** Les chemins stockés deviennent des URL servies par l'API au dernier moment. */
export function toPublicUser(row: PublicUserRow): PublicUserDto {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatarPath ? `/uploads/${row.avatarPath}` : null,
    bannerUrl: row.bannerPath ? `/uploads/${row.bannerPath}` : null,
  };
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Identifiants des amis acceptés. Base de tout ce qui est visible entre amis. */
  async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
  }

  /** La relation telle que `userId` la voit, dans les deux sens. */
  async relation(userId: string, otherId: string) {
    if (userId === otherId) return relationTo(userId, otherId, null);
    const row = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
      select: { id: true, requesterId: true, addresseeId: true, status: true },
    });
    return relationTo(userId, otherId, row);
  }

  async search(userId: string, q: string): Promise<UserSearchResultDto[]> {
    const users = await this.prisma.user.findMany({
      // `contains` insensible à la casse : on cherche un pseudo entendu ou à moitié retenu
      where: { username: { contains: q, mode: 'insensitive' }, id: { not: userId } },
      select: publicUserSelect,
      orderBy: { username: 'asc' },
      take: SEARCH_LIMIT,
    });
    if (users.length === 0) return [];

    const links = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: { in: users.map((u) => u.id) } },
          { addresseeId: userId, requesterId: { in: users.map((u) => u.id) } },
        ],
      },
      select: { id: true, requesterId: true, addresseeId: true, status: true },
    });
    const byUser = new Map<string, FriendshipRow>(
      links.map((link) => [otherSide(userId, link), link]),
    );

    return users.map((user) => ({
      ...toPublicUser(user),
      ...relationTo(userId, user.id, byUser.get(user.id)),
    }));
  }

  async list(userId: string): Promise<FriendDto[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: {
        respondedAt: true,
        createdAt: true,
        requester: { select: publicUserSelect },
        addressee: { select: publicUserSelect },
      },
      orderBy: { respondedAt: 'desc' },
    });
    if (rows.length === 0) return [];

    const friends = rows.map((row) => ({
      user: row.requester.id === userId ? row.addressee : row.requester,
      since: (row.respondedAt ?? row.createdAt).toISOString(),
    }));
    const stats = await this.stats(friends.map((f) => f.user.id));

    return friends.map(({ user, since }) => ({
      ...toPublicUser(user),
      friendsSince: since,
      stats: stats.get(user.id) ?? emptyStats(),
    }));
  }

  /** Demandes en attente, dans les deux sens : la page des amis les montre séparément. */
  async requests(userId: string): Promise<FriendRequestDto[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'PENDING', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: {
        id: true,
        createdAt: true,
        requesterId: true,
        requester: { select: publicUserSelect },
        addressee: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      const outgoing = row.requesterId === userId;
      return {
        id: row.id,
        user: toPublicUser(outgoing ? row.addressee : row.requester),
        direction: outgoing ? ('OUTGOING' as const) : ('INCOMING' as const),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  /**
   * Envoi d'une demande par pseudo. Deux cas méritent d'être traités plutôt que refusés :
   * renvoyer la même demande (rejouable, ça n'en crée pas deux) et demander à quelqu'un qui
   * l'a déjà fait — là, on accepte la sienne, puisque les deux sont d'accord.
   */
  async request(userId: string, username: string): Promise<UserSearchResultDto> {
    const target = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: publicUserSelect,
    });
    if (!target) throw new NotFoundException(t('errors.userNotFound'));
    if (target.id === userId) throw new BadRequestException(t('errors.cannotFriendSelf'));

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
      select: { id: true, requesterId: true, addresseeId: true, status: true },
    });

    if (existing?.status === 'ACCEPTED') throw new ConflictException(t('errors.alreadyFriends'));

    if (existing) {
      if (existing.requesterId === userId) {
        return { ...toPublicUser(target), ...relationTo(userId, target.id, existing) };
      }
      // L'autre avait déjà demandé : les deux sont d'accord, on scelle
      await this.respond(userId, existing.id, true);
      return { ...toPublicUser(target), state: 'FRIENDS', requestId: null };
    }

    const created = await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id },
      select: { id: true, requesterId: true, addresseeId: true, status: true },
    });
    return { ...toPublicUser(target), ...relationTo(userId, target.id, created) };
  }

  /**
   * Accepter ou refuser. Seul le destinataire décide, et un refus **supprime** la ligne : la
   * personne pourra redemander plus tard, ce qu'un statut « refusé » rendrait impossible sans
   * un chemin de nettoyage dédié.
   */
  async respond(userId: string, requestId: string, accept: boolean): Promise<void> {
    const request = await this.prisma.friendship.findFirst({
      where: { id: requestId, addresseeId: userId, status: 'PENDING' },
      select: { id: true },
    });
    if (!request) throw new NotFoundException(t('errors.requestNotFound'));

    if (accept) {
      await this.prisma.friendship.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      return;
    }
    await this.prisma.friendship.delete({ where: { id: request.id } });
  }

  /** Retire l'ami, ou annule la demande envoyée : même geste côté interface, même route. */
  async remove(userId: string, otherId: string): Promise<void> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
    });
    if (count === 0) throw new NotFoundException(t('errors.notFriends'));
  }

  async stats(userIds: string[]): Promise<Map<string, SocialStatsDto>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<SocialStatsRow[]>(socialStats(userIds));
    return new Map(
      rows.map((row) => [
        row.userId,
        {
          distinctCards: row.distinctCards,
          copies: row.copies,
          sets: row.sets,
          completedSets: row.completedSets,
        },
      ]),
    );
  }
}

export const emptyStats = (): SocialStatsDto => ({
  distinctCards: 0,
  copies: 0,
  sets: 0,
  completedSets: 0,
});
