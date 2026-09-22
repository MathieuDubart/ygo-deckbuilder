import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Résout des IDs de cartes venant de l'extérieur (.ydk, listes de tournoi) vers nos cartes :
 * un ID d'artwork alternatif (Ash Blossom 14558128) devient la carte principale (14558127).
 */
@Injectable()
export class CardResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Map id externe → id de carte ; les IDs inconnus sont absents de la map. */
  async resolve(ids: number[]): Promise<Map<number, number>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const [cards, arts] = await Promise.all([
      this.prisma.card.findMany({ where: { id: { in: unique } }, select: { id: true } }),
      this.prisma.cardArt.findMany({
        where: { id: { in: unique } },
        select: { id: true, cardId: true },
      }),
    ]);
    return new Map([
      ...arts.map((a) => [a.id, a.cardId] as const),
      ...cards.map((c) => [c.id, c.id] as const),
    ]);
  }

  /** Applique la résolution à une liste en ignorant les inconnus. */
  static apply(ids: number[], map: Map<number, number>): number[] {
    return ids.flatMap((id) => {
      const r = map.get(id);
      return r === undefined ? [] : [r];
    });
  }
}
