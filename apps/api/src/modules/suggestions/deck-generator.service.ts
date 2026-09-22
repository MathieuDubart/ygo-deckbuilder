import { Injectable, NotFoundException } from '@nestjs/common';
import type { GeneratedDeckDto, GenerationMode } from '@ygo/shared';
import { cardSummarySelect, toCardSummary, toNumber } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../collection/ownership.service';
import {
  generateFromArchetype,
  generateFromTemplate,
  type GenCardInfo,
  type GenerationResult,
  type Staple,
} from '../meta-decks/engine/generator';
import type { DeckTemplate } from '../meta-decks/engine/types';

/**
 * Génération automatique de decks (aperçu, rien n'est enregistré) :
 *  - depuis un archétype du meta : liste type complète, ou version "avec mes cartes"
 *  - depuis un archétype de la collection, quand il n'y a pas de liste de tournoi
 * Le front crée ensuite le deck via POST /decks s'il est satisfait.
 */
@Injectable()
export class DeckGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async fromMeta(
    userId: string,
    metaDeckId: string,
    mode: GenerationMode,
  ): Promise<GeneratedDeckDto> {
    const meta = await this.prisma.metaDeck.findUnique({
      where: { id: metaDeckId },
      include: { cards: true },
    });
    if (!meta) throw new NotFoundException('Deck meta introuvable');

    const template: DeckTemplate = {
      cards: meta.cards.filter((c) => !c.flex),
      flex: meta.cards.filter((c) => c.flex),
      mainSize: Math.max(
        40,
        meta.cards.filter((c) => c.zone === 'MAIN' && !c.flex).reduce((s, c) => s + c.quantity, 0),
      ),
    };

    const owned = await this.ownership.quantities(userId);
    const [staples, archetypeCards] = await Promise.all([
      mode === 'OWNED' ? this.ownedStaples(owned) : [],
      mode === 'OWNED' && meta.archetype ? this.ownedArchetypeCards(userId, meta.archetype) : [],
    ]);

    const ids = [
      ...template.cards.map((c) => c.cardId),
      ...template.flex.map((c) => c.cardId),
      ...staples.map((s) => s.cardId),
      ...archetypeCards,
    ];
    const cards = await this.cardInfo(ids);
    const result = generateFromTemplate(template, { mode, cards, owned, staples, archetypeCards });

    const notes: string[] = [];
    if (mode === 'OWNED' && !result.complete) {
      notes.push(
        `Il te manque ${40 - result.counts.MAIN} cartes pour atteindre 40 avec ta collection : bascule sur la liste meta pour voir quoi acheter.`,
      );
    }
    if (meta.listCount) {
      notes.push(`Basé sur ${meta.listCount} liste(s) de tournoi récente(s).`);
    }

    return this.toDto(result, {
      name: mode === 'OWNED' ? `${meta.name} (ma collection)` : meta.name,
      mode,
      metaDeckId: meta.id,
      archetype: meta.archetype,
      notes,
    });
  }

  async fromArchetype(userId: string, archetype: string): Promise<GeneratedDeckDto> {
    const owned = await this.ownership.quantities(userId);
    const [archetypeCards, supportCards, staples] = await Promise.all([
      this.ownedArchetypeCards(userId, archetype),
      this.ownedSupportCards(userId, archetype),
      this.ownedStaples(owned),
    ]);
    if (!archetypeCards.length) {
      throw new NotFoundException(`Aucune carte « ${archetype} » dans ta collection`);
    }
    const cards = await this.cardInfo([
      ...archetypeCards,
      ...supportCards,
      ...staples.map((s) => s.cardId),
    ]);
    const result = generateFromArchetype({ cards, owned, archetypeCards, supportCards, staples });

    const metaVersion = await this.prisma.metaDeck.findFirst({
      where: { archetype: { equals: archetype, mode: 'insensitive' } },
      orderBy: { listCount: 'desc' },
      select: { name: true },
    });
    const notes = [
      'Deck construit uniquement avec tes cartes : archétype, cartes qui le citent, puis staples du meta.',
    ];
    if (!result.complete)
      notes.push(`Il manque ${40 - result.counts.MAIN} cartes pour atteindre 40.`);
    if (metaVersion)
      notes.push(`Une version tournoi existe : « ${metaVersion.name} » dans les decks meta.`);

    return this.toDto(result, {
      name: `${archetype} (auto)`,
      mode: 'ARCHETYPE',
      metaDeckId: null,
      archetype,
      notes,
    });
  }

  // ─── Sources de cartes ────────────────────────────────────────────────────

  /** Staples du meta possédés, du plus joué au moins joué. */
  private async ownedStaples(owned: Map<number, number>): Promise<Staple[]> {
    const staples = await this.prisma.cardMetaStat.findMany({
      where: { isStaple: true, cardId: { in: [...owned.keys()] } },
      orderBy: { deckShare: 'desc' },
      select: { cardId: true, avgCopies: true },
    });
    return staples;
  }

  /** Cartes possédées de l'archétype, les plus jouées en tournoi d'abord, monstres avant magies/pièges. */
  private async ownedArchetypeCards(userId: string, archetype: string): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c.id FROM "Card" c
      LEFT JOIN "CardMetaStat" m ON m."cardId" = c.id
      WHERE lower(c.archetype) = lower(${archetype})
        AND EXISTS (SELECT 1 FROM "CollectionItem" ci WHERE ci."cardId" = c.id AND ci."userId" = ${userId})
      ORDER BY m."deckShare" DESC NULLS LAST,
               CASE c.category WHEN 'MONSTER' THEN 0 WHEN 'SPELL' THEN 1 ELSE 2 END,
               c.name`;
    return rows.map((r) => r.id);
  }

  /** Cartes possédées hors archétype dont le texte le cite ("… a "Blue-Eyes" monster …"). */
  private async ownedSupportCards(userId: string, archetype: string): Promise<number[]> {
    const pattern = `%"${archetype}"%`;
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c.id FROM "Card" c
      LEFT JOIN "CardMetaStat" m ON m."cardId" = c.id
      WHERE (c.archetype IS NULL OR lower(c.archetype) <> lower(${archetype}))
        AND c."desc" ILIKE ${pattern}
        AND EXISTS (SELECT 1 FROM "CollectionItem" ci WHERE ci."cardId" = c.id AND ci."userId" = ${userId})
      ORDER BY m."deckShare" DESC NULLS LAST, c.name
      LIMIT 30`;
    return rows.map((r) => r.id);
  }

  private async cardInfo(ids: number[]): Promise<Map<number, GenCardInfo>> {
    const rows = await this.prisma.card.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, isExtraDeck: true, banTcg: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async toDto(
    result: GenerationResult,
    meta: Pick<GeneratedDeckDto, 'name' | 'mode' | 'metaDeckId' | 'archetype' | 'notes'>,
  ): Promise<GeneratedDeckDto> {
    const cards = await this.prisma.card.findMany({
      where: { id: { in: result.entries.map((e) => e.cardId) } },
      select: cardSummarySelect,
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const entries = result.entries.flatMap((e) => {
      const card = byId.get(e.cardId);
      return card ? [{ ...e, card: toCardSummary(card, e.owned) }] : [];
    });
    const missingCost = entries.reduce(
      (s, e) => s + (e.quantity - e.owned) * (toNumber(byId.get(e.cardId)!.priceCardmarket) ?? 0),
      0,
    );
    return {
      ...meta,
      cards: entries.map(({ card, zone, quantity, owned, source, inclusion }) => ({
        card,
        zone,
        quantity,
        owned,
        source,
        inclusion,
      })),
      counts: result.counts,
      missingCopies: result.missingCopies,
      missingCost: Math.round(missingCost * 100) / 100,
      complete: result.complete,
    };
  }
}
