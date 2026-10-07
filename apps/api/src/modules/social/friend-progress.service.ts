import { Injectable } from '@nestjs/common';
import type { FriendsProgressDto, FriendSetProgressDto, SetFriendsDto } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FriendsService, publicUserSelect, toPublicUser } from './friends.service';
import {
  anyEditionOwners,
  friendsSetProgress,
  printOwners,
  type FriendSetProgressRow,
  type PrintOwnerRow,
} from './social.sql';

/**
 * Avancement des amis sur les extensions. Deux formes, pour deux endroits : un résumé par
 * extension pour la liste, et le détail impression par impression pour la fiche.
 *
 * Les deux partent toujours de `friendIds` : un compte qui n'est pas ami n'apparaît nulle
 * part, même si son identifiant est deviné.
 */
@Injectable()
export class FriendProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  /** Résumé pour une page de la liste des extensions. */
  async forSets(userId: string, setIds: string[]): Promise<FriendsProgressDto> {
    const out: FriendsProgressDto = {};
    if (setIds.length === 0) return out;

    const friendIds = await this.friends.friendIds(userId);
    if (friendIds.length === 0) return out;

    const [rows, users] = await Promise.all([
      this.prisma.$queryRaw<FriendSetProgressRow[]>(friendsSetProgress(friendIds, setIds)),
      this.prisma.user.findMany({ where: { id: { in: friendIds } }, select: publicUserSelect }),
    ]);
    const byId = new Map(users.map((user) => [user.id, toPublicUser(user)]));

    for (const row of rows) {
      const user = byId.get(row.userId);
      if (!user) continue;
      (out[row.setId] ??= []).push({
        user,
        prints: row.prints,
        cards: row.cards,
        ownedPrints: row.ownedPrints,
        ownedCards: row.ownedCards,
      });
    }
    // Le plus avancé d'abord : c'est l'ordre qu'on lit dans une comparaison
    for (const list of Object.values(out)) {
      list.sort((a, b) => ratio(b) - ratio(a) || a.user.username.localeCompare(b.user.username));
    }
    return out;
  }

  /** Détail d'une extension : avancement de chaque ami, et qui possède quelle impression. */
  async forSet(userId: string, setId: string): Promise<SetFriendsDto> {
    const empty: SetFriendsDto = { friends: [], owners: {}, ownersAnyEdition: {} };
    const friendIds = await this.friends.friendIds(userId);
    if (friendIds.length === 0) return empty;

    const [progress, exact, elsewhere] = await Promise.all([
      this.forSets(userId, [setId]),
      this.prisma.$queryRaw<PrintOwnerRow[]>(printOwners(friendIds, setId)),
      this.prisma.$queryRaw<PrintOwnerRow[]>(anyEditionOwners(friendIds, setId)),
    ]);

    return {
      friends: progress[setId] ?? [],
      owners: group(exact),
      ownersAnyEdition: group(elsewhere),
    };
  }
}

const ratio = (row: FriendSetProgressDto): number =>
  row.prints > 0 ? row.ownedPrints / row.prints : 0;

const group = (rows: PrintOwnerRow[]): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const row of rows) (out[row.printId] ??= []).push(row.userId);
  return out;
};
