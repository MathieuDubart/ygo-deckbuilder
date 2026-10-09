import { Injectable, Logger } from '@nestjs/common';
import { parsePrintCode, type PrintLookupDto } from '@ygo/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogSyncService } from '../catalog-sync/catalog-sync.service';
import { CardsService } from './cards.service';

/**
 * Délai avant de redemander la même extension à YGOPRODeck. Une extension qu'ils ne
 * connaissent pas ne sera pas inventée en dix minutes, et scanner un paquet entier de cartes
 * d'une extension inconnue ne doit pas déclencher une requête par carte.
 */
const RETRY_AFTER_MS = 10 * 60_000;

/**
 * Résolution d'un code imprimé (« DUAD-FR001 ») en carte.
 *
 * Le scanner lisait le code puis faisait une recherche texte : quand l'extension manquait au
 * catalogue — typiquement une sortie postérieure à la dernière synchro hebdomadaire — la
 * recherche ne renvoyait rien et l'écran disait « aucune carte trouvée », sans dire que le
 * problème venait de NOTRE catalogue et pas de la lecture. On rattrape donc l'extension à la
 * demande, et on nomme la cause quand ça échoue quand même.
 */
@Injectable()
export class PrintLookupService {
  private readonly logger = new Logger(PrintLookupService.name);
  /** Préfixe → moment avant lequel on ne redemande pas. */
  private readonly tried = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly catalog: CatalogSyncService,
  ) {}

  async resolve(rawCode: string, userId?: string): Promise<PrintLookupDto> {
    const code = parsePrintCode(rawCode);
    if (!code) return { status: 'INVALID_CODE', code: rawCode };

    const found = await this.find(code, userId);
    if (found) return { status: 'FOUND', code: rawCode, ...found };

    // Rien en base : soit l'extension nous manque, soit c'est ce numéro-là qui manque.
    if (!this.shouldFetch(code.set)) {
      return { status: await this.missingReason(code.set), code: rawCode };
    }
    this.tried.set(code.set, Date.now() + RETRY_AFTER_MS);

    let imported: string | null = null;
    try {
      imported = (await this.catalog.syncSetByPrefix(code.set))?.setName ?? null;
    } catch (e) {
      // Source injoignable : on répond avec ce qu'on sait, le scan continue
      this.logger.warn(`Rattrapage de l'extension ${code.set} impossible : ${e}`);
    }
    if (!imported) return { status: await this.missingReason(code.set), code: rawCode };

    const after = await this.find(code, userId);
    return after
      ? { status: 'FOUND', code: rawCode, imported, ...after }
      : { status: 'UNKNOWN_NUMBER', code: rawCode, imported };
  }

  /** La carte et ses impressions, si une impression porte ce code — toutes langues confondues. */
  private async find(code: { set: string; number: string }, userId?: string) {
    const match = await this.prisma.$queryRaw<{ cardId: number }[]>`
      SELECT p."cardId" FROM "CardPrint" p
      WHERE upper(split_part(p."printCode", '-', 1)) = ${code.set}
        AND regexp_replace(split_part(p."printCode", '-', 2), '^[A-Za-z]*', '') = ${code.number}
      LIMIT 1`;
    const cardId = match[0]?.cardId;
    if (cardId === undefined) return null;
    return { card: await this.cards.findOne(cardId, userId) };
  }

  /** Extension absente du catalogue, ou présente mais sans ce numéro : ça ne se répare pas pareil. */
  private async missingReason(prefix: string): Promise<'UNKNOWN_SET' | 'UNKNOWN_NUMBER'> {
    const set = await this.prisma.cardSet.findFirst({
      where: { code: { equals: prefix, mode: 'insensitive' } },
      select: { id: true },
    });
    return set ? 'UNKNOWN_NUMBER' : 'UNKNOWN_SET';
  }

  private shouldFetch(prefix: string): boolean {
    const until = this.tried.get(prefix);
    return until === undefined || Date.now() > until;
  }
}
