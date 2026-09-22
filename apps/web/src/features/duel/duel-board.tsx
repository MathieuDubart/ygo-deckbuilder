'use client';
import type {
  DuelActionDto,
  DuelCardDto,
  DuelCardRef,
  DuelPlayerDto,
  DuelStateDto,
} from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CardBack, DuelCardFace, FieldCard } from './duel-card';
import { refKey, type CardMap } from './duel-utils';

export type Pile = 'GRAVE' | 'BANISHED' | 'EXTRA';
export interface ZoneRef {
  controller: 0 | 1;
  location: 'MZONE' | 'SZONE';
  sequence: number;
}

export interface BoardHandlers {
  /** Clic sur une carte (actions possibles, ou fiche) */
  onCard: (card: DuelCardRef, anchor: HTMLElement) => void;
  onZone: (zone: ZoneRef) => void;
  onPile: (controller: 0 | 1, pile: Pile) => void;
  onHover: (code: number | null) => void;
}

interface BoardProps extends BoardHandlers {
  state: DuelStateDto;
  cards: CardMap;
  actions: Map<string, DuelActionDto[]>;
  /** Zones libres pendant une invite PLACE */
  placeable: Set<string>;
  /** Zones déjà choisies (invite PLACE à plusieurs zones) */
  picked: Set<string>;
}

/**
 * Terrain vu depuis ta place : l'adversaire en haut (miroir), toi en bas, les Zones Monstre
 * Extra au milieu. Colonnes : [Terrain/Extra] [5 zones] [Cimetière/Deck], bannies au milieu.
 */
export function DuelBoard(props: BoardProps) {
  const { state, cards } = props;
  const t = useTranslations('duel.board');
  const [me, opp] = state.players;
  const mirror = [4, 3, 2, 1, 0];
  const chainKeys = new Set(state.chain.map((c) => refKey(c.card)));

  // Zones Monstre Extra partagées : à gauche ta zone 5 ou la zone 6 adverse, à droite l'inverse
  const emz = (mine: number, theirs: number) => {
    const card = me.monsters[mine] ?? opp.monsters[theirs] ?? null;
    const zones: ZoneRef[] = [
      { controller: 0, location: 'MZONE', sequence: mine },
      { controller: 1, location: 'MZONE', sequence: theirs },
    ];
    return <Zone {...props} card={card} zones={zones} chainKeys={chainKeys} kind="emz" />;
  };

  return (
    <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-2">
      <Hand player={opp} controller={1} {...props} />
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {/* Adversaire : Magies & Pièges */}
        <DeckPile player={opp} label={t('deck')} />
        {mirror.map((i) => (
          <Zone
            key={`os${i}`}
            {...props}
            card={opp.spells[i] ?? null}
            chainKeys={chainKeys}
            zones={[{ controller: 1, location: 'SZONE', sequence: i }]}
            kind="spell"
          />
        ))}
        <PileZone {...props} controller={1} pile="EXTRA" list={opp.extra} count={opp.extraCount} />
        {/* Adversaire : Monstres */}
        <PileZone
          {...props}
          controller={1}
          pile="GRAVE"
          list={opp.grave}
          count={opp.grave.length}
        />
        {mirror.map((i) => (
          <Zone
            key={`om${i}`}
            {...props}
            card={opp.monsters[i] ?? null}
            chainKeys={chainKeys}
            zones={[{ controller: 1, location: 'MZONE', sequence: i }]}
            kind="monster"
          />
        ))}
        <Zone
          {...props}
          card={opp.spells[5] ?? null}
          chainKeys={chainKeys}
          zones={[{ controller: 1, location: 'SZONE', sequence: 5 }]}
          kind="field"
        />
        {/* Milieu : bannies adverses, Zones Monstre Extra, chaîne, tes bannies */}
        <PileZone
          {...props}
          controller={1}
          pile="BANISHED"
          list={opp.banished}
          count={opp.banished.length}
        />
        <div />
        {emz(5, 6)}
        <ChainStack state={state} cards={cards} />
        {emz(6, 5)}
        <div />
        <PileZone
          {...props}
          controller={0}
          pile="BANISHED"
          list={me.banished}
          count={me.banished.length}
        />
        {/* Toi : Monstres */}
        <Zone
          {...props}
          card={me.spells[5] ?? null}
          chainKeys={chainKeys}
          zones={[{ controller: 0, location: 'SZONE', sequence: 5 }]}
          kind="field"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <Zone
            key={`mm${i}`}
            {...props}
            card={me.monsters[i] ?? null}
            chainKeys={chainKeys}
            zones={[{ controller: 0, location: 'MZONE', sequence: i }]}
            kind="monster"
          />
        ))}
        <PileZone {...props} controller={0} pile="GRAVE" list={me.grave} count={me.grave.length} />
        {/* Toi : Magies & Pièges */}
        <PileZone {...props} controller={0} pile="EXTRA" list={me.extra} count={me.extraCount} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Zone
            key={`ms${i}`}
            {...props}
            card={me.spells[i] ?? null}
            chainKeys={chainKeys}
            zones={[{ controller: 0, location: 'SZONE', sequence: i }]}
            kind="spell"
          />
        ))}
        <DeckPile player={me} label={t('deck')} />
      </div>
      <Hand player={me} controller={0} {...props} />
    </div>
  );
}

// MARK: - Zones

const zoneTone = {
  monster: 'border-monster/25',
  emz: 'border-extra/30',
  spell: 'border-spell/25',
  field: 'border-spell/25 border-dashed',
} as const;

function Zone({
  card,
  zones,
  kind,
  cards,
  actions,
  placeable,
  picked,
  chainKeys,
  onCard,
  onZone,
  onHover,
}: BoardProps & {
  card: DuelCardDto | null;
  zones: ZoneRef[];
  kind: keyof typeof zoneTone;
  chainKeys: Set<string>;
}) {
  const t = useTranslations('duel.board');
  const target = zones.find((z) => placeable.has(refKey(z)));
  const selected = zones.some((z) => picked.has(refKey(z)));
  const key = card ? refKey(card) : null;
  const actionable = key ? actions.has(key) : false;
  const inChain = key ? chainKeys.has(key) : false;

  const className = cn(
    'relative aspect-(--aspect-card) rounded-md border bg-bg-sunken/60 transition',
    zoneTone[kind],
    target && 'cursor-pointer border-accent bg-accent/15 ring-1 ring-accent/60 hover:bg-accent/25',
    selected && 'border-accent bg-accent/35 ring-2 ring-accent',
    actionable && 'cursor-pointer ring-2 ring-accent shadow-[0_0_14px_-2px_var(--accent)]',
    inChain && 'ring-2 ring-trap',
  );

  if (target)
    return (
      <button type="button" className={className} onClick={() => onZone(target)}>
        {card && <FieldCard card={card} cards={cards} showStats={card.location === 'MZONE'} />}
      </button>
    );
  if (!card) return <div className={className} />;
  return (
    <button
      type="button"
      className={className}
      title={actionable ? t('actionable') : undefined}
      onClick={(e) => onCard(card, e.currentTarget)}
      onMouseEnter={() => onHover(card.code || null)}
      onMouseLeave={() => onHover(null)}
    >
      <FieldCard card={card} cards={cards} showStats={card.location === 'MZONE'} />
    </button>
  );
}

function PileZone({
  controller,
  pile,
  list,
  count,
  cards,
  actions,
  onPile,
  onHover,
}: BoardProps & { controller: 0 | 1; pile: Pile; list: DuelCardDto[]; count: number }) {
  const t = useTranslations('duel.board');
  const label = t(pile === 'GRAVE' ? 'grave' : pile === 'BANISHED' ? 'banished' : 'extra');
  const top = list.at(-1);
  const actionable = list.some((c) => actions.has(refKey(c)));
  // L'Extra Deck adverse reste secret si tu ne le contrôles pas (liste vide)
  const openable = list.length > 0;
  return (
    <button
      type="button"
      disabled={!openable}
      onClick={() => onPile(controller, pile)}
      onMouseEnter={() => onHover(pile !== 'EXTRA' && top?.code ? top.code : null)}
      onMouseLeave={() => onHover(null)}
      title={`${label} (${count})`}
      className={cn(
        'relative aspect-(--aspect-card) rounded-md border border-border bg-bg-sunken/40 transition',
        openable && 'hover:border-border-strong',
        actionable && 'ring-2 ring-accent shadow-[0_0_14px_-2px_var(--accent)]',
        pile === 'BANISHED' && 'opacity-90',
      )}
    >
      {count > 0 &&
        (pile === 'EXTRA' ? (
          <CardBack className="opacity-90" />
        ) : top ? (
          <DuelCardFace
            card={top}
            cards={cards}
            className={pile === 'BANISHED' ? 'saturate-50' : ''}
          />
        ) : null)}
      <span className="absolute inset-x-0 bottom-0.5 mx-auto w-fit rounded bg-black/75 px-1 text-[9px] leading-tight font-medium text-white">
        <span className="hidden sm:inline">{label} · </span>
        <span className="font-mono tabular-nums">{count}</span>
      </span>
    </button>
  );
}

function DeckPile({ player, label }: { player: DuelPlayerDto; label: string }) {
  return (
    <div
      className="relative aspect-(--aspect-card) rounded-md border border-border"
      title={`${label} (${player.deckCount})`}
    >
      {player.deckCount > 0 && <CardBack />}
      <span className="absolute inset-x-0 bottom-0.5 mx-auto w-fit rounded bg-black/75 px-1 text-[9px] leading-tight font-medium text-white">
        <span className="hidden sm:inline">{label} · </span>
        <span className="font-mono tabular-nums">{player.deckCount}</span>
      </span>
    </div>
  );
}

function ChainStack({ state, cards }: { state: DuelStateDto; cards: CardMap }) {
  const t = useTranslations('duel.board');
  if (!state.chain.length) return <div />;
  return (
    <div
      className="relative flex aspect-(--aspect-card) flex-col items-center justify-center"
      title={t('chain')}
    >
      {state.chain.map((link, i) => (
        <div
          key={i}
          className="absolute w-[70%]"
          style={{ transform: `translate(${i * 6 - (state.chain.length - 1) * 3}px, ${i * -6}px)` }}
        >
          <DuelCardFace card={link.card} cards={cards} className="shadow-lg ring-1 ring-trap" />
        </div>
      ))}
      <span className="absolute -bottom-1 z-10 rounded bg-trap px-1.5 font-mono text-[10px] font-bold text-black">
        {t('chain')} {state.chain.length}
      </span>
    </div>
  );
}

// MARK: - Mains

function Hand({
  player,
  controller,
  state,
  cards,
  actions,
  onCard,
  onHover,
}: BoardProps & { player: DuelPlayerDto; controller: 0 | 1 }) {
  const t = useTranslations('duel.board');
  const mine = controller === 0;
  const active = state.turnPlayer === controller && !state.finished;
  return (
    <div className={cn('flex items-center gap-3', !mine && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex w-20 shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 sm:w-24',
          active ? 'border-accent/60 bg-accent/10' : 'border-border bg-bg-elevated',
        )}
      >
        <span className="text-[10px] tracking-wide text-fg-subtle uppercase">
          {mine ? t('you') : t('opponent')}
        </span>
        <span className="font-mono text-lg font-semibold tabular-nums">{player.lp}</span>
        <span className="text-[10px] text-fg-subtle">{t('lp')}</span>
      </div>
      <div
        className={cn(
          'flex min-h-16 flex-1 items-end justify-center overflow-x-auto py-1',
          player.hand.length > 6 ? '-space-x-3 sm:-space-x-2' : 'gap-1',
        )}
        aria-label={t('hand')}
      >
        {player.hand.map((card) => {
          const actionable = actions.has(refKey(card));
          return (
            <button
              key={refKey(card)}
              type="button"
              onClick={(e) => onCard(card, e.currentTarget)}
              onMouseEnter={() => onHover(card.code || null)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                'relative shrink-0 rounded-[4%/3%] transition hover:z-10 hover:-translate-y-1.5',
                mine ? 'w-12 sm:w-16' : 'w-9 sm:w-11',
                actionable &&
                  'z-[1] -translate-y-1 ring-2 ring-accent shadow-[0_0_14px_-2px_var(--accent)]',
              )}
            >
              <DuelCardFace card={card} cards={cards} sizes="64px" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
