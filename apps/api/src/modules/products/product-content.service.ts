import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { YugipediaClient } from '../catalog-sync/yugipedia.client';
import { isValidTitle } from '../catalog-sync/yugipedia.parser';
import { parseSetList, setListTitles } from './set-list.parser';

/** Sans liste trouvée, on réessaie au bout d'une semaine (les pages Yugipedia se complètent). */
const RETRY_AFTER_MS = 7 * 86_400_000;
/** Au-delà, l'import continue avec 1 exemplaire par carte plutôt que de faire attendre. */
export const CONTENT_TIMEOUT_MS = 10_000;

/**
 * Quantités officielles d'un produit (ex. 3 « Blue-Eyes White Dragon » dans un Structure
 * Deck) : YGOPRODeck ne les donne pas, Yugipedia oui (« Set Card Lists:… »). Lues une fois
 * par produit, à la demande, et stockées sur les impressions (CardPrint.setQuantity).
 */
@Injectable()
export class ProductContentService {
  private readonly logger = new Logger(ProductContentService.name);
  private readonly inFlight = new Map<string, Promise<boolean>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly yugipedia: YugipediaClient,
    private readonly config: AppConfig,
  ) {}

  /** true si les quantités officielles sont connues (après lecture si besoin). */
  ensure(setId: string): Promise<boolean> {
    let p = this.inFlight.get(setId);
    if (!p) {
      p = this.load(setId).finally(() => this.inFlight.delete(setId));
      this.inFlight.set(setId, p);
    }
    return p;
  }

  /** Comme `ensure`, mais n'attend jamais plus de `CONTENT_TIMEOUT_MS` (la lecture continue). */
  async ensureQuickly(setId: string): Promise<boolean> {
    const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), CONTENT_TIMEOUT_MS));
    return Promise.race([this.ensure(setId).catch(() => false), timeout]);
  }

  private async load(setId: string): Promise<boolean> {
    const set = await this.prisma.cardSet.findUnique({
      where: { id: setId },
      select: { name: true, contentSource: true, contentCheckedAt: true },
    });
    if (!set) return false;
    if (set.contentSource) return true;
    if (set.contentCheckedAt && Date.now() - set.contentCheckedAt.getTime() < RETRY_AFTER_MS) {
      return false;
    }
    if (!this.config.get('PRODUCT_COVERS_ENABLED') || !isValidTitle(set.name)) return false;

    try {
      const title = await this.yugipedia.resolveTitle(set.name);
      const page = title ? await this.yugipedia.firstExistingWikitext(setListTitles(title)) : null;
      const rows = page ? parseSetList(page.text) : [];
      const qty = new Map(rows.map((r) => [r.code, r.quantity]));

      const prints = await this.prisma.cardPrint.findMany({
        where: { setId },
        select: { id: true, printCode: true },
      });
      const matched = prints.filter((p) => qty.has(p.printCode.toUpperCase()));
      const codes = new Set(prints.map((p) => p.printCode));
      const matchedCodes = new Set(matched.map((p) => p.printCode));
      // Liste fiable si elle couvre la majorité des impressions connues du produit
      const reliable = matched.length > 0 && matchedCodes.size >= codes.size / 2;

      await this.prisma.$transaction([
        ...(reliable
          ? matched.map((p) =>
              this.prisma.cardPrint.update({
                where: { id: p.id },
                data: { setQuantity: qty.get(p.printCode.toUpperCase())! },
              }),
            )
          : []),
        this.prisma.cardSet.update({
          where: { id: setId },
          data: { contentCheckedAt: new Date(), contentSource: reliable ? 'yugipedia' : null },
        }),
      ]);
      this.logger.log(
        reliable
          ? `Quantités officielles de « ${set.name} » : ${matchedCodes.size}/${codes.size} impressions`
          : `Pas de liste officielle exploitable pour « ${set.name} »`,
      );
      return reliable;
    } catch (e) {
      this.logger.warn(`Liste officielle de « ${set.name} » indisponible : ${e}`);
      await this.prisma.cardSet
        .update({ where: { id: setId }, data: { contentCheckedAt: new Date() } })
        .catch(() => undefined);
      return false;
    }
  }
}
