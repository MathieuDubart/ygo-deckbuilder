import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * "Combien d'exemplaires de la carte X je possède ?" — question posée par quasi
 * tous les modules (recherche, decks, suggestions). Centralisé ici.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quantités possédées par cardId (toutes éditions/états confondus). */
  async quantities(userId: string, cardIds?: number[]): Promise<Map<number, number>> {
    const rows = await this.prisma.collectionItem.groupBy({
      by: ['cardId'],
      where: { userId, ...(cardIds && { cardId: { in: cardIds } }) },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.cardId, r._sum.quantity ?? 0]));
  }
}
