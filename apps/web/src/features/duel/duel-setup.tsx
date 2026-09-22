'use client';
import {
  DUEL_SETUP_LOCATIONS,
  DUEL_SETUP_POSITIONS,
  type CreateDuelInput,
  type DuelBoardCardInput,
  type DuelOpponentControl,
} from '@ygo/shared';
import { BookOpen, Plus, Search, Swords, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { CardImage } from '@/components/cards/card-image';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/input';
import { useCard, useCardSearch } from '@/lib/api/cards';
import { useDeck, useDecks } from '@/lib/api/decks';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';

const HAND_MAX = 6;
const ZONE_LIMIT: Partial<Record<DuelBoardCardInput['location'], number>> = {
  MZONE: 5,
  SZONE: 5,
  FZONE: 1,
};

export const defaultSetup = (deckId = ''): CreateDuelInput => ({
  deckId,
  goingFirst: true,
  openingHand: [],
  startingLP: 8000,
  opponent: { control: 'PASSIVE', board: [] },
});

/** Préparation du duel : ton deck, qui commence, ta main de départ et le plateau adverse. */
export function DuelSetup({
  value,
  onChange,
  onStart,
  busy,
}: {
  value: CreateDuelInput;
  onChange: (next: CreateDuelInput) => void;
  onStart: () => void;
  busy: boolean;
}) {
  const t = useTranslations('duel.setup');
  const tp = useTranslations('duel.page');
  const decks = useDecks();
  const set = (patch: Partial<CreateDuelInput>) => onChange({ ...value, ...patch });
  const setOpponent = (patch: Partial<CreateDuelInput['opponent']>) =>
    onChange({ ...value, opponent: { ...value.opponent, ...patch } });

  // Deck jouable choisi d'office (le plus complet) ; un deck supprimé depuis la dernière config est oublié
  const firstDeck = decks.data?.length
    ? (
        decks.data.find((d) => d.mainCount >= 40) ??
        [...decks.data].sort((a, b) => b.mainCount - a.mainCount)[0]!
      ).id
    : undefined;
  const known = !!decks.data?.some((d) => d.id === value.deckId);
  useEffect(() => {
    if (firstDeck && !known) onChange({ ...value, deckId: firstDeck, openingHand: [] });
  }, [firstDeck, known, onChange, value]);

  if (decks.isLoading) return <Skeleton className="h-96" />;
  if (!decks.data?.length)
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-fg-muted">
        {t('noDecks')}
      </p>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-5 rounded-2xl border border-border bg-bg-elevated p-5">
        <h2 className="font-semibold">{t('title')}</h2>
        <Field label={t('deck')}>
          <Select
            value={value.deckId}
            onChange={(e) => set({ deckId: e.target.value, openingHand: [] })}
          >
            <option value="" disabled>
              {t('deckPlaceholder')}
            </option>
            {decks.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.mainCount})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('first.label')}>
            <Segmented
              value={value.goingFirst ? 'me' : 'opponent'}
              options={[
                { value: 'me', label: t('first.me') },
                { value: 'opponent', label: t('first.opponent') },
              ]}
              onChange={(v) => set({ goingFirst: v === 'me' })}
            />
          </Field>
          <Field label={t('lp')}>
            <Input
              type="number"
              min={100}
              max={99999}
              step={100}
              value={value.startingLP}
              onChange={(e) => set({ startingLP: Math.max(100, Number(e.target.value) || 8000) })}
            />
          </Field>
        </div>

        <OpponentControl
          value={value.opponent.control}
          onChange={(control) => setOpponent({ control })}
        />

        <Field label={t('opponentDeck.label')}>
          <Select
            value={value.opponent.deckId ?? ''}
            onChange={(e) => setOpponent({ deckId: e.target.value || undefined })}
          >
            <option value="">{t('opponentDeck.copy')}</option>
            {decks.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>

        {value.deckId && (
          <OpeningHand
            deckId={value.deckId}
            hand={value.openingHand}
            onChange={(openingHand) => set({ openingHand })}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="lg" disabled={!value.deckId} loading={busy} onClick={onStart}>
            <Swords className="size-5" /> {t('start')}
          </Button>
          <Link
            href="/rules"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
          >
            <BookOpen className="size-4" />
            {tp('rules')}
          </Link>
        </div>
      </section>

      <OpponentBoard board={value.opponent.board} onChange={(board) => setOpponent({ board })} />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-bg-sunken p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 flex-1 rounded-md px-2 font-medium transition disabled:opacity-40',
            value === o.value ? 'bg-bg-elevated text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function OpponentControl({
  value,
  onChange,
}: {
  value: DuelOpponentControl;
  onChange: (v: DuelOpponentControl) => void;
}) {
  const t = useTranslations('duel.setup.opponent');
  const options = [
    { id: 'PASSIVE', enabled: true },
    { id: 'ME', enabled: true },
    { id: 'BOT', enabled: false },
  ] as const;
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-fg-muted uppercase">
        {t('label')}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map(({ id, enabled }) => (
          <button
            key={id}
            type="button"
            disabled={!enabled}
            onClick={() => id !== 'BOT' && onChange(id)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
              value === id
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-border-strong',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2 text-sm font-medium">
              {t(id)}
              {!enabled && (
                <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] text-fg-subtle">
                  {t('soon')}
                </span>
              )}
            </span>
            <span className="text-xs text-fg-muted">{t(`${id}_hint`)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// MARK: - Main de départ

function OpeningHand({
  deckId,
  hand,
  onChange,
}: {
  deckId: string;
  hand: number[];
  onChange: (hand: number[]) => void;
}) {
  const t = useTranslations('duel.setup.hand');
  const deck = useDeck(deckId);
  const main = useMemo(
    () => (deck.data?.cards ?? []).filter((c) => c.zone === 'MAIN'),
    [deck.data],
  );
  const used = (id: number) => hand.filter((h) => h === id).length;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">{t('label')}</p>
          <p className="text-xs text-fg-subtle">{t('hint')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="font-mono">{t('count', { count: hand.length, max: HAND_MAX })}</span>
          {hand.length > 0 && (
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => onChange([])}
            >
              {t('clear')}
            </button>
          )}
        </div>
      </div>
      {deck.isLoading ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="grid max-h-64 grid-cols-6 gap-1.5 overflow-y-auto rounded-xl bg-bg-sunken/60 p-2 sm:grid-cols-8">
          {main.map((c) => {
            const n = used(c.cardId);
            const full = n >= c.quantity || hand.length >= HAND_MAX;
            return (
              <button
                key={c.cardId}
                type="button"
                title={c.card.name}
                onClick={() =>
                  n > 0 && full
                    ? onChange(removeOne(hand, c.cardId))
                    : !full && onChange([...hand, c.cardId])
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (n > 0) onChange(removeOne(hand, c.cardId));
                }}
                className={cn(
                  'relative rounded-[4%/3%] transition',
                  n > 0 ? 'ring-2 ring-accent' : full ? 'opacity-40' : 'hover:brightness-110',
                )}
              >
                <CardImage card={c.card} sizes="64px" />
                {n > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-accent-fg">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function removeOne(list: number[], id: number): number[] {
  const i = list.lastIndexOf(id);
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
}

// MARK: - Plateau adverse

function OpponentBoard({
  board,
  onChange,
}: {
  board: DuelBoardCardInput[];
  onChange: (board: DuelBoardCardInput[]) => void;
}) {
  const t = useTranslations('duel.setup.board');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const search = useCardSearch({ q: query, page: 1, pageSize: 8 }, query.length >= 2);
  const count = (loc: DuelBoardCardInput['location']) =>
    board.filter((b) => b.location === loc).length;
  const room = (loc: DuelBoardCardInput['location']) =>
    ZONE_LIMIT[loc] === undefined || count(loc) < ZONE_LIMIT[loc]!;

  const add = (card: { id: number; category: string; type: string }) => {
    const preferred: DuelBoardCardInput['location'] =
      card.category === 'MONSTER' ? 'MZONE' : /field/i.test(card.type) ? 'FZONE' : 'SZONE';
    const location = room(preferred) ? preferred : 'HAND';
    onChange([
      ...board,
      {
        cardId: card.id,
        location,
        position: location === 'SZONE' ? 'SET' : 'ATTACK',
      },
    ]);
    setQ('');
  };
  const update = (i: number, patch: Partial<DuelBoardCardInput>) =>
    onChange(board.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-5">
      <div className="space-y-1">
        <h2 className="font-semibold">{t('label')}</h2>
        <p className="text-xs text-fg-muted">{t('hint')}</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-fg-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          className="pl-9"
        />
        {query.length >= 2 && q && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border-strong bg-bg-elevated p-1 shadow-2xl">
            {search.data?.items.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => add(card)}
                  className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left text-sm hover:bg-bg-sunken"
                >
                  <CardImage card={card} sizes="32px" className="w-8 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{card.name}</span>
                  <Plus className="size-4 text-fg-subtle" />
                </button>
              </li>
            ))}
            {search.data && !search.data.items.length && (
              <li className="px-3 py-2 text-sm text-fg-subtle">{t('noResults')}</li>
            )}
          </ul>
        )}
      </div>

      {!board.length ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-fg-subtle">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {board.map((b, i) => (
            <BoardRow
              key={i}
              entry={b}
              canMove={(loc) => loc === b.location || room(loc)}
              onChange={(patch) => update(i, patch)}
              onRemove={() => onChange(board.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BoardRow({
  entry,
  canMove,
  onChange,
  onRemove,
}: {
  entry: DuelBoardCardInput;
  canMove: (loc: DuelBoardCardInput['location']) => boolean;
  onChange: (patch: Partial<DuelBoardCardInput>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('duel.setup.board');
  const card = useCard(entry.cardId);
  const onField = entry.location === 'MZONE' || entry.location === 'SZONE';
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-bg-sunken/50 p-2">
      <div className="w-10 shrink-0">
        {card.data ? (
          <CardImage card={card.data} sizes="40px" />
        ) : (
          <Skeleton className="aspect-(--aspect-card)" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-sm font-medium">{card.data?.name ?? `#${entry.cardId}`}</p>
        <div className="flex flex-wrap gap-1.5">
          <Select
            aria-label={t('locations.MZONE')}
            className="h-8 w-auto text-xs"
            value={entry.location}
            onChange={(e) => {
              const location = e.target.value as DuelBoardCardInput['location'];
              onChange({
                location,
                zone: undefined,
                position: location === 'SZONE' ? 'SET' : 'ATTACK',
              });
            }}
          >
            {DUEL_SETUP_LOCATIONS.map((loc) => (
              <option key={loc} value={loc} disabled={!canMove(loc)}>
                {t(`locations.${loc}`)}
              </option>
            ))}
          </Select>
          {onField && (
            <Select
              aria-label={t('positions.ATTACK')}
              className="h-8 w-auto text-xs"
              value={entry.position}
              onChange={(e) =>
                onChange({ position: e.target.value as DuelBoardCardInput['position'] })
              }
            >
              {DUEL_SETUP_POSITIONS.filter(
                (p) => entry.location === 'MZONE' || p === 'SET' || p === 'ATTACK',
              ).map((p) => (
                <option key={p} value={p}>
                  {entry.location === 'SZONE' && p === 'ATTACK'
                    ? t('positions.FACE_UP')
                    : t(`positions.${p}`)}
                </option>
              ))}
            </Select>
          )}
          {onField && (
            <Select
              aria-label={t('zone')}
              className="h-8 w-auto text-xs"
              value={entry.zone ?? ''}
              onChange={(e) =>
                onChange({ zone: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            >
              <option value="">{`${t('zone')} : ${t('auto')}`}</option>
              {[0, 1, 2, 3, 4].map((z) => (
                <option key={z} value={z}>
                  {`${t('zone')} ${z + 1}`}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('remove')}
        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-elevated hover:text-danger"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
