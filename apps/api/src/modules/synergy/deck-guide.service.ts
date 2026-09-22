import { Injectable } from '@nestjs/common';
import type { CardSummaryDto, DeckGuideDto, DeckGuideRequest, GuideRole } from '@ygo/shared';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiGuideService, type AiGuide, type AiResult } from './ai-guide.service';
import { findCombos } from './engine/combos';
import { analyzeDeck, type DeckEntry } from './engine/graph';
import { translator } from '../../common/i18n/locale-context';
import { buildRuleGuide, type RuleGuide } from './engine/guide';
import { SynergyCardsService } from './synergy-cards.service';

/**
 * Guide de jeu d'une liste : calculé à partir des effets (rôles, liens, combos, Extra Deck),
 * puis — si une IA est configurée — reformulé et enrichi par le modèle.
 */
@Injectable()
export class DeckGuideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly synCards: SynergyCardsService,
    private readonly ai: AiGuideService,
  ) {}

  async guide(input: DeckGuideRequest): Promise<DeckGuideDto> {
    const ids = [...new Set(input.cards.map((c) => c.cardId))];
    const [full, summaries] = await Promise.all([
      this.synCards.load(ids),
      this.prisma.card.findMany({ where: { id: { in: ids } }, select: cardSummarySelect }),
    ]);
    const byId = new Map(full.map((c) => [c.id, c]));
    const summary = new Map(summaries.map((c) => [c.id, toCardSummary(c)]));

    // Une ligne par (carte, zone) : on fusionne les doublons éventuels
    const merged = new Map<string, DeckEntry>();
    for (const c of input.cards) {
      const card = byId.get(c.cardId);
      if (!card) continue;
      const key = `${c.zone}:${c.cardId}`;
      const prev = merged.get(key);
      merged.set(key, { card, zone: c.zone, quantity: (prev?.quantity ?? 0) + c.quantity });
    }
    const entries = [...merged.values()];
    const analysis = analyzeDeck(entries);
    const combos = findCombos(entries, analysis, 3);
    const name = (id: number) => summary.get(id)?.name ?? byId.get(id)?.name ?? `#${id}`;
    const tr = translator();
    const rules = buildRuleGuide(entries, analysis, combos, name, tr);

    let result: AiResult = { status: 'OFF' };
    if (input.ai && this.ai.enabled) {
      result = await this.ai.request(
        input.name,
        entries.map((e) => ({
          name: e.card.name,
          localName: name(e.card.id),
          zone: e.zone,
          quantity: e.quantity,
          type: e.card.type,
          desc: e.card.desc,
          roles: (analysis.roles.get(e.card.id) ?? []).map((r) => tr.t(`roles.${r}`)),
        })),
        rules,
      );
    }
    const ai: AiGuide | null = result.status === 'READY' ? result.guide : null;
    const aiError = result.status === 'ERROR' ? result.error : null;

    const guide = ai ? merge(rules, ai, entries, name) : { ...rules, tips: [] };
    const referenced = new Set<number>([
      ...guide.keyCards.map((k) => k.cardId),
      ...guide.combos.flatMap((c) => [
        ...c.handIds,
        ...c.endBoardIds,
        ...c.steps.flatMap((s) => s.cardIds),
      ]),
    ]);
    const cards: Record<string, CardSummaryDto> = {};
    for (const id of referenced) {
      const s = summary.get(id);
      if (s) cards[id] = s;
    }

    return {
      source: ai ? 'AI' : 'RULES',
      model: ai ? this.ai.model : null,
      aiAvailable: this.ai.enabled,
      aiStatus: result.status,
      aiError,
      ...guide,
      keyCards: guide.keyCards.map((k) => ({ ...k, roles: k.roles as GuideRole[] })),
      cards,
    };
  }
}

/** Texte de l'IA + structure calculée (cartes clés reliées par nom, combos et stats conservés). */
function merge(
  rules: RuleGuide,
  ai: AiGuide,
  entries: DeckEntry[],
  name: (id: number) => string,
): RuleGuide & { tips: string[] } {
  const norm = (s: string) => s.toLowerCase().replace(/[«»"]/g, '').trim();
  const idByName = new Map<string, number>();
  for (const e of entries) {
    idByName.set(norm(e.card.name), e.card.id);
    idByName.set(norm(name(e.card.id)), e.card.id);
  }
  const aiWhy = new Map<number, string>();
  for (const k of ai.keyCards) {
    const id = idByName.get(norm(k.name));
    if (id !== undefined) aiWhy.set(id, k.why);
  }
  // Cartes clés : celles de l'IA d'abord (si reconnues), complétées par le calcul
  const keyCards = [
    ...[...aiWhy].map(([cardId, why]) => ({
      cardId,
      roles: rules.keyCards.find((k) => k.cardId === cardId)?.roles ?? [],
      why,
    })),
    ...rules.keyCards.filter((k) => !aiWhy.has(k.cardId)),
  ].slice(0, 8);

  return {
    ...rules,
    summary: ai.summary,
    gamePlan: ai.gamePlan,
    keyCards,
    goingFirst: ai.goingFirst.length ? ai.goingFirst : rules.goingFirst,
    goingSecond: ai.goingSecond.length ? ai.goingSecond : rules.goingSecond,
    mistakes: ai.mistakes,
    tips: ai.tips,
  };
}
