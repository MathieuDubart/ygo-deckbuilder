import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CardInteractionGroupDto,
  CardInteractionsDto,
  CardSummaryDto,
  InteractionVerb,
} from '@ygo/shared';
import { cardSummarySelect, toCardSummary } from '../../common/mappers/card.mapper';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { OwnershipService } from '../collection/ownership.service';
import { featuresOf } from './engine/graph';
import { describeFilter, nameKeys, targetsOfCard, type EffectTarget } from './engine/interactions';
import { matches } from './engine/parse';
import type { CardFilter, Location, SynCard } from './engine/types';
import { InteractionIndexService } from './interaction-index.service';
import { synCardSelect, type FullCard } from './synergy-cards.service';
import { t, translator } from '../../common/i18n/locale-context';

/** Cartes affichées par groupe (le total reste exact dans la limite des candidats lus). */
const PER_GROUP = 30;
const MAX_CANDIDATES = 600;
const MAX_INCOMING_ROWS = 4000;

type Row = {
  cardId: number;
  verb: string;
  locations: string[];
  quoted: string[];
  except: string[];
  kinds: string[];
  subtypes: string[];
  races: string[];
  attributes: string[];
  levelEq: number | null;
  levelMin: number | null;
  levelMax: number | null;
  tuner: boolean | null;
  nonTuner: boolean | null;
  precision: number;
};

interface RawGroup {
  direction: 'OUT' | 'IN';
  verb: InteractionVerb;
  target: string | null;
  precision: 'DIRECT' | 'PRECISE';
  ids: number[];
}

/**
 * Exploration d'une carte : ce qu'elle va chercher / invoquer / utiliser (calculé à partir
 * de son texte), et les cartes qui la cherchent / l'invoquent / l'utilisent (index en base).
 */
@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly index: InteractionIndexService,
  ) {}

  async forCard(cardId: number, userId?: string): Promise<CardInteractionsDto> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: synCardSelect,
    });
    if (!card) throw new NotFoundException(t('errors.cardNotFound'));
    const features = featuresOf(card);
    const targets = targetsOfCard(card, features);

    const [outgoing, incoming, state] = await Promise.all([
      Promise.all(targets.filter((t) => t.precision > 0).map((t) => this.outgoing(card, t))),
      this.incoming(card),
      this.index.state(),
    ]);
    const groups = [...mergeOut(outgoing), ...incoming].filter((g) => g.ids.length);

    // Résumés + possession, puis tri : mes cartes d'abord, puis les plus populaires
    const ids = [...new Set(groups.flatMap((g) => g.ids))];
    const [rows, owned] = await Promise.all([
      this.prisma.card.findMany({
        where: { id: { in: ids } },
        select: { ...cardSummarySelect, popularity: true },
      }),
      userId ? this.ownership.quantities(userId, ids) : Promise.resolve(new Map<number, number>()),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const rank = (id: number) => [owned.get(id) ?? 0, byId.get(id)?.popularity ?? 0] as const;
    const sortIds = (xs: number[]) =>
      [...xs].sort((a, b) => {
        const [oa, pa] = rank(a);
        const [ob, pb] = rank(b);
        return Number(ob > 0) - Number(oa > 0) || pb - pa;
      });

    const toDto = (g: RawGroup): CardInteractionGroupDto => ({
      direction: g.direction,
      verb: g.verb,
      target: g.target,
      precision: g.precision,
      total: g.ids.length,
      cards: sortIds(g.ids)
        .slice(0, PER_GROUP)
        .flatMap((id): CardSummaryDto[] => {
          const r = byId.get(id);
          return r ? [toCardSummary(r, userId ? (owned.get(id) ?? 0) : undefined)] : [];
        }),
    });

    return {
      cardId,
      groups: groups.map(toDto),
      generic: targets
        .filter((t) => t.precision === 0 && t.verb !== 'MENTION')
        .map((t) => ({
          verb: t.verb as InteractionVerb,
          target: describeFilter(t.filter, translator()),
        })),
      ownedLinked: ids.filter((id) => (owned.get(id) ?? 0) > 0).length,
      indexed: !!state?.lastSyncAt,
    };
  }

  // ─── Ce que fait la carte ─────────────────────────────────────────────────

  private async outgoing(card: FullCard, t: EffectTarget): Promise<RawGroup> {
    const candidates = await this.prisma.card.findMany({
      where: prefilter(card, t),
      select: synCardSelect,
      orderBy: [{ popularity: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: MAX_CANDIDATES,
    });
    const where = locationsFor(t.verb, t.locations);
    const ids = candidates
      .filter((c) => matches(c, t.filter, featuresOf(c), where))
      .map((c) => c.id);
    return {
      direction: 'OUT',
      verb: t.verb as InteractionVerb,
      target: describeFilter(t.filter, translator()),
      precision: t.precision === 2 ? 'DIRECT' : 'PRECISE',
      ids,
    };
  }

  // ─── Ce que les autres font avec elle ─────────────────────────────────────

  private async incoming(card: FullCard): Promise<RawGroup[]> {
    const features = featuresOf(card);
    const keys = nameKeys(card, features);
    const level = card.level ?? -1;
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT "cardId", verb, locations, quoted, "except", kinds, subtypes, races, attributes,
             "levelEq", "levelMin", "levelMax", tuner, "nonTuner", precision
      FROM "CardEffectTarget" t
      WHERE t."cardId" <> ${card.id}
        AND (
          (t.precision = 2 AND t.keys && ${keys}::text[])
          OR (
            t.precision = 1 AND cardinality(t.keys) = 0
            AND (cardinality(t.attributes) = 0 OR ${card.attribute ?? ''} = ANY(t.attributes))
            AND (cardinality(t.races) = 0 OR ${card.race ?? ''} = ANY(t.races))
            AND (t."levelEq" IS NULL OR t."levelEq" = ${level})
            AND (t."levelMin" IS NULL OR ${level} >= t."levelMin")
            AND (t."levelMax" IS NULL OR ${level} <= t."levelMax")
          )
        )
      LIMIT ${MAX_INCOMING_ROWS}`;

    const groups = new Map<string, RawGroup>();
    for (const r of rows) {
      const verb = r.verb as InteractionVerb;
      const locations = r.locations as Location[];
      // On ne cherche pas un monstre d'Extra Deck dans le Deck
      if (
        card.isExtraDeck &&
        verb !== 'MATERIAL' &&
        verb !== 'MENTION' &&
        verb !== 'SUMMON_EXTRA'
      ) {
        if (
          !locations.some((l) => l === 'GY' || l === 'FIELD' || l === 'BANISHED' || l === 'EXTRA')
        )
          continue;
      }
      if (!card.isExtraDeck && verb === 'SUMMON_EXTRA') continue;
      if (!matches(card, rowFilter(r), features, locationsFor(verb, locations))) continue;
      const precision = r.precision === 2 ? 'DIRECT' : 'PRECISE';
      const k = `${verb}|${precision}`;
      const g = groups.get(k) ?? {
        direction: 'IN' as const,
        verb,
        target: null,
        precision,
        ids: [],
      };
      if (!g.ids.includes(r.cardId)) g.ids.push(r.cardId);
      groups.set(k, g);
    }
    // Direct avant précis, puis par type de lien
    return [...groups.values()].sort(
      (a, b) => Number(a.precision !== 'DIRECT') - Number(b.precision !== 'DIRECT'),
    );
  }
}

/** Matériaux et citations : la carte est sur le terrain / n'importe où (noms "sur le terrain" inclus). */
function locationsFor(verb: string, locations: Location[]): Location[] | undefined {
  return verb === 'MATERIAL' || verb === 'MENTION' || !locations.length ? undefined : locations;
}

/** Même cible lue plusieurs fois (2 effets qui cherchent la même chose) → un seul groupe. */
function mergeOut(groups: RawGroup[]): RawGroup[] {
  const byKey = new Map<string, RawGroup>();
  for (const g of groups) {
    const k = `${g.verb}|${g.target}`;
    const prev = byKey.get(k);
    if (prev) prev.ids = [...new Set([...prev.ids, ...g.ids])];
    else byKey.set(k, { ...g });
  }
  return [...byKey.values()];
}

function rowFilter(r: Row): CardFilter {
  return {
    quoted: r.quoted,
    except: r.except,
    kinds: r.kinds as CardFilter['kinds'],
    subtypes: r.subtypes,
    races: r.races,
    attributes: r.attributes,
    ...(r.levelEq !== null && { levelEq: r.levelEq }),
    ...(r.levelMin !== null && { levelMin: r.levelMin }),
    ...(r.levelMax !== null && { levelMax: r.levelMax }),
    ...(r.tuner !== null && { tuner: r.tuner }),
    ...(r.nonTuner !== null && { nonTuner: r.nonTuner }),
  };
}

/** Pré-filtre SQL large (vérifié ensuite carte par carte avec `matches`). */
function prefilter(card: SynCard, t: EffectTarget): Prisma.CardWhereInput {
  const f = t.filter;
  const and: Prisma.CardWhereInput[] = [{ id: { not: card.id } }];
  if (f.quoted.length) {
    and.push({
      OR: f.quoted.flatMap((q) => [
        { name: { contains: q } },
        { archetype: { equals: q, mode: 'insensitive' as const } },
        // "Toujours traitée comme une carte "X"" / "son nom devient "X""
        { desc: { contains: `treated as a "${q}"` } },
        { desc: { contains: `treated as an "${q}"` } },
        { desc: { contains: `name becomes "${q}"` } },
      ]),
    });
  }
  const kinds = f.kinds.filter((k) => k === 'MONSTER' || k === 'SPELL' || k === 'TRAP');
  if (kinds.length) and.push({ category: { in: kinds } });
  if (f.attributes.length) and.push({ attribute: { in: f.attributes } });
  if (f.races.length) and.push({ race: { in: f.races } });
  if (f.levelEq !== undefined) and.push({ level: f.levelEq });
  if (f.levelMin !== undefined) and.push({ level: { gte: f.levelMin } });
  if (f.levelMax !== undefined) and.push({ level: { lte: f.levelMax } });
  if (f.tuner) and.push({ type: { contains: 'Tuner' } });

  // Où la cible doit se trouver : le Deck / la main ne contiennent pas l'Extra Deck
  if (t.verb === 'SUMMON_EXTRA') and.push({ isExtraDeck: true });
  else if (
    t.verb !== 'MATERIAL' &&
    t.verb !== 'MENTION' &&
    t.locations.length &&
    t.locations.every((l) => l === 'DECK' || l === 'HAND')
  ) {
    and.push({ isExtraDeck: false });
  }
  return { AND: and };
}
