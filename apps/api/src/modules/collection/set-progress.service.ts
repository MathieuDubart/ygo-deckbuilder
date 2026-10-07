import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

/**
 * Tenue à jour de `SetProgress` : combien de cartes d'une extension un utilisateur possède,
 * sur combien elle en contient.
 *
 * Les mêmes chiffres se déduisent de `CollectionItem` × `CardPrint`, mais les rejouer à
 * chaque affichage coûte une passe sur tout le catalogue. On les écrit donc à chaque
 * mouvement de collection — c'est-à-dire rarement — et on les lit partout ailleurs.
 *
 * Deux règles tiennent la cohérence :
 *  - un mouvement sur une carte recalcule TOUTES les extensions qui la contiennent, pas
 *    seulement celle de l'impression touchée : « possédée toutes éditions confondues »
 *    dépend de la carte, pas de l'impression ;
 *  - une synchro du catalogue reconstruit tout, parce qu'une nouvelle impression change les
 *    totaux d'extensions auxquelles l'utilisateur n'a pas touché.
 */
@Injectable()
export class SetProgressService {
  private readonly logger = new Logger(SetProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Après un mouvement sur ces cartes : recalcule les extensions qui les contiennent. */
  async afterCards(userId: string, cardIds: number[]): Promise<void> {
    const ids = [...new Set(cardIds)];
    if (!ids.length) return;
    await this.recompute(
      userId,
      Prisma.sql`SELECT DISTINCT "setId" AS id FROM "CardPrint" WHERE "cardId" IN (${Prisma.join(ids)})`,
    );
  }

  /** Reconstruit l'avancement d'un utilisateur sur tout le catalogue. */
  async rebuild(userId: string): Promise<void> {
    await this.recompute(userId, Prisma.sql`SELECT id FROM "CardSet"`);
  }

  /** Après une synchro du catalogue : les totaux ont bougé pour tout le monde. */
  async rebuildAll(): Promise<number> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) await this.rebuild(user.id);
    if (users.length)
      this.logger.log(`Avancement par extension reconstruit (${users.length} comptes)`);
    return users.length;
  }

  /**
   * Un seul énoncé : les lignes utiles sont écrites, celles qui ne le sont plus (dernière
   * carte de l'extension retirée) disparaissent. Les deux voient le même instantané, donc
   * la table ne passe jamais par un état incohérent.
   */
  private async recompute(userId: string, scope: Prisma.Sql): Promise<void> {
    await this.prisma.$executeRaw`
      WITH scope AS (${scope}),
      -- Posséder une impression implique posséder la carte : partir des cartes possédées
      -- couvre donc toutes les extensions où l'utilisateur a quelque chose.
      reach AS (
        SELECT p."setId", COUNT(DISTINCT p."cardId")::int AS "ownedCards"
        FROM "CardPrint" p
        JOIN scope ON scope.id = p."setId"
        JOIN (SELECT DISTINCT "cardId" FROM "CollectionItem" WHERE "userId" = ${userId}) mine
          ON mine."cardId" = p."cardId"
        GROUP BY 1
      ),
      tot AS (
        SELECT p."setId", COUNT(*)::int AS prints, COUNT(DISTINCT p."cardId")::int AS cards
        FROM "CardPrint" p JOIN scope ON scope.id = p."setId"
        GROUP BY 1
      ),
      exact AS (
        SELECT p."setId",
               COUNT(DISTINCT p.id)::int AS "ownedPrints",
               SUM(ci.quantity)::int AS copies
        FROM "CollectionItem" ci
        JOIN "CardPrint" p ON p.id = ci."printId"
        JOIN scope ON scope.id = p."setId"
        WHERE ci."userId" = ${userId}
        GROUP BY 1
      ),
      upserted AS (
        INSERT INTO "SetProgress"
          ("userId", "setId", "prints", "cards", "ownedPrints", "ownedCards", "copies", "updatedAt")
        SELECT ${userId}, r."setId",
               COALESCE(t.prints, 0), COALESCE(t.cards, 0),
               COALESCE(e."ownedPrints", 0), r."ownedCards", COALESCE(e.copies, 0),
               CURRENT_TIMESTAMP
        FROM reach r
        LEFT JOIN tot t ON t."setId" = r."setId"
        LEFT JOIN exact e ON e."setId" = r."setId"
        ON CONFLICT ("userId", "setId") DO UPDATE SET
          "prints" = EXCLUDED."prints",
          "cards" = EXCLUDED."cards",
          "ownedPrints" = EXCLUDED."ownedPrints",
          "ownedCards" = EXCLUDED."ownedCards",
          "copies" = EXCLUDED."copies",
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "setId"
      )
      DELETE FROM "SetProgress" sp
      WHERE sp."userId" = ${userId}
        AND sp."setId" IN (SELECT id FROM scope)
        AND sp."setId" NOT IN (SELECT "setId" FROM upserted)`;
  }
}
