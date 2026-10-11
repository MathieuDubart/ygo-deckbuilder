import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_RUNNABLE_SYNCS,
  type AdminOverviewDto,
  type AdminRunnableSync,
  type AdminSyncDto,
  type AdminUserDto,
  type AdminUsersQueryInput,
  type Paginated,
} from '@ygo/shared';
import { constants } from 'node:fs';
import { access, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AppConfig } from '../../config/app-config.service';
import { t } from '../../common/i18n/locale-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BanlistService } from '../banlist/banlist.service';
import { CatalogSyncService } from '../catalog-sync/catalog-sync.service';
import { UpcomingSetsService } from '../catalog-sync/upcoming-sets.service';
import { MetaSyncService } from '../meta-decks/meta-sync.service';

/**
 * Ce que l'administrateur d'une instance a besoin de savoir et de pouvoir.
 *
 * Volontairement étroit. Le service lit beaucoup et n'écrit qu'une chose : le rôle d'un
 * compte. Tout ce qui détruit — effacer un utilisateur, vider une table — reste en SSH,
 * où l'on est forcément attentif et où l'on a une sauvegarde sous la main.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly catalog: CatalogSyncService,
    private readonly banlist: BanlistService,
    private readonly meta: MetaSyncService,
    private readonly upcoming: UpcomingSetsService,
  ) {}

  async users(query: AdminUsersQueryInput): Promise<Paginated<AdminUserDto>> {
    const { page, pageSize } = query;
    const where = {
      ...(query.role ? { role: query.role } : {}),
      // Pseudo OU email : l'admin a l'un ou l'autre en tête, rarement les deux
      ...(query.q
        ? {
            OR: [
              { username: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: query.sort === 'name' ? { username: 'asc' } : { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          avatarPath: true,
          _count: { select: { decks: true, ownedProducts: true, collectionItems: true } },
          // La dernière session encore valide : le seul repère de présence qu'on garde,
          // et il s'efface tout seul quand les jetons expirent.
          refreshTokens: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      }),
    ]);

    const copies = await this.copiesByUser(rows.map((r) => r.id));
    const adminEmail = this.config.get('ADMIN_EMAIL');
    const items: AdminUserDto[] = rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      role: r.role as 'USER' | 'ADMIN',
      createdAt: r.createdAt.toISOString(),
      avatarUrl: r.avatarPath ? `/uploads/${r.avatarPath}` : null,
      copies: copies.get(r.id) ?? 0,
      distinctCards: r._count.collectionItems,
      decks: r._count.decks,
      products: r._count.ownedProducts,
      lastSeenAt: r.refreshTokens[0]?.createdAt.toISOString() ?? null,
      pinnedByEnv: !!adminEmail && r.email === adminEmail,
    }));

    // Les tris par volume portent sur des chiffres que la base ne stocke pas tels quels
    if (query.sort === 'cards') items.sort((a, b) => b.copies - a.copies);
    if (query.sort === 'decks') items.sort((a, b) => b.decks - a.decks);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Change le rôle d'un compte.
   *
   * Deux garde-fous, et les deux viennent du même principe : on ne doit pas pouvoir se
   * fermer la porte. Se rétrograder soi-même laisserait une instance sans administrateur si
   * c'est le seul ; rétrograder le compte d'`ADMIN_EMAIL` ne tiendrait pas une connexion,
   * puisqu'il reprend son rôle à l'ouverture de session.
   */
  async setRole(actorId: string, userId: string, role: 'USER' | 'ADMIN'): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException(t('errors.userNotFound'));

    if (role === 'USER') {
      if (user.id === actorId) throw new BadRequestException(t('errors.cannotDemoteSelf'));
      const adminEmail = this.config.get('ADMIN_EMAIL');
      if (adminEmail && user.email === adminEmail) {
        throw new BadRequestException(t('errors.cannotDemoteEnvAdmin'));
      }
    }

    await this.prisma.user.update({ where: { id: userId }, data: { role } });
    // On relit par la liste pour que l'appelant reçoive exactement la même forme qu'ailleurs
    const { items } = await this.users({ page: 1, pageSize: 1, q: user.email });
    return items[0]!;
  }

  async overview(): Promise<AdminOverviewDto> {
    const [counts, syncs, health] = await Promise.all([
      this.counts(),
      this.syncs(),
      this.health(),
    ]);
    return { counts, syncs, health };
  }

  /** Relance une synchro. La réponse arrive à la fin : certaines prennent des minutes. */
  async runSync(id: AdminRunnableSync): Promise<void> {
    switch (id) {
      case 'ygoprodeck':
        await this.catalog.sync({ force: false });
        return;
      case 'ygoprodeck-banlist':
        await this.banlist.refresh();
        return;
      case 'meta':
        await this.meta.sync();
        return;
      case 'yugipedia-upcoming':
        await this.upcoming.refresh();
        return;
    }
  }

  private async counts() {
    const [users, cards, prints, sets, collectionItems, decks, products, copies, uploadsBytes] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.card.count(),
        this.prisma.cardPrint.count(),
        this.prisma.cardSet.count(),
        this.prisma.collectionItem.count(),
        this.prisma.deck.count(),
        this.prisma.ownedProduct.count(),
        this.prisma.collectionItem.aggregate({ _sum: { quantity: true } }),
        this.uploadsSize(),
      ]);
    return {
      users,
      cards,
      prints,
      sets,
      collectionItems,
      copies: copies._sum.quantity ?? 0,
      decks,
      products,
      uploadsBytes,
    };
  }

  /**
   * Toutes les lignes d'état, PLUS les synchros qu'on sait lancer et qui n'en ont pas encore.
   *
   * Les deux moitiés comptent. Lire la table couvre les états internes qu'on n'a pas prévus
   * ici — une synchro ajoutée demain apparaît d'elle-même. Et compléter avec la liste des
   * synchros lançables est ce qui rend le panneau utile sur une instance NEUVE : une
   * synchro qui n'a jamais tourné n'a pas de ligne, donc sans ça elle serait invisible
   * exactement au moment où l'on vient pour la lancer.
   */
  private async syncs(): Promise<AdminSyncDto[]> {
    const rows = await this.prisma.syncState.findMany({ orderBy: { id: 'asc' } });
    const seen = new Set(rows.map((r) => r.id));
    const known: AdminSyncDto[] = ADMIN_RUNNABLE_SYNCS.filter((id) => !seen.has(id)).map((id) => ({
      id,
      lastSyncAt: null,
      lastStatus: null,
      lastError: null,
      count: 0,
      databaseVersion: null,
      runnable: true,
    }));
    const runnable = new Set<string>(ADMIN_RUNNABLE_SYNCS);
    return [
      ...rows.map((r) => ({
        id: r.id,
        lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
        lastStatus: r.lastStatus,
        lastError: r.lastError,
        count: r.cardCount,
        databaseVersion: r.databaseVersion,
        runnable: runnable.has(r.id),
      })),
      ...known,
    ]
      // Ce qu'on peut relancer d'abord : c'est ce qu'on vient voir
      .sort((a, b) => Number(b.runnable) - Number(a.runnable) || a.id.localeCompare(b.id));
  }

  private async health() {
    const uploads = this.config.get('UPLOADS_DIR');
    const [database, uploadsWritable, duelData] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`.then(() => true)
        .catch(() => false),
      access(uploads, constants.W_OK)
        .then(() => true)
        .catch(() => false),
      this.duelData(),
    ]);
    return {
      database,
      uploadsWritable,
      duelData,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  private async duelData(): Promise<'READY' | 'MISSING' | 'DISABLED'> {
    if (!this.config.get('DUEL_ENABLED')) return 'DISABLED';
    const dir = this.config.get('DUEL_DATA_DIR');
    try {
      return (await readdir(dir)).length > 0 ? 'READY' : 'MISSING';
    } catch {
      return 'MISSING';
    }
  }

  /** Taille du dossier d'images, à plat : il n'a qu'un niveau de sous-dossiers. */
  private async uploadsSize(): Promise<number> {
    const root = this.config.get('UPLOADS_DIR');
    let total = 0;
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else total += await stat(full).then((s) => s.size, () => 0);
      }
    };
    await walk(root);
    return total;
  }

  /** Exemplaires possédés par utilisateur, en une requête plutôt qu'une par ligne. */
  private async copiesByUser(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.collectionItem.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.userId, r._sum.quantity ?? 0]));
  }
}
