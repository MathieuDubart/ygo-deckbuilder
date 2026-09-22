'use client';
import type { DuelChoiceCard, DuelPosition, DuelPromptDto, DuelStateDto } from '@ygo/shared';
import { Check, RotateCcw, Search, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCardSearch } from '@/lib/api/cards';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';
import { DuelCardFace } from './duel-card';
import { fillSystemText, type CardMap } from './duel-utils';
import type { DuelAnswer } from './use-duel';

type Prompt<K extends DuelPromptDto['kind']> = Extract<DuelPromptDto, { kind: K }>;

interface PanelProps {
  state: DuelStateDto;
  cards: CardMap;
  busy: boolean;
  /** Zones déjà choisies pour une invite PLACE à plusieurs zones */
  pickedCount: number;
  onResetPicks: () => void;
  onRespond: (answer: DuelAnswer) => void;
  onInspect: (code: number) => void;
}

/**
 * Ce que le moteur attend : consigne, puis le choix adapté (cartes, zones, oui/non…).
 * Les actions de Main / Battle Phase se jouent directement sur le terrain.
 */
export function PromptPanel(props: PanelProps) {
  const { state, busy, onRespond } = props;
  const t = useTranslations('duel');
  const prompt = state.prompt;
  if (!prompt || state.finished) return null;

  return (
    <section
      aria-live="polite"
      className={cn(
        'rounded-2xl border bg-bg-elevated p-4 shadow-lg',
        prompt.player === 1 ? 'border-trap/50' : 'border-accent/40',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      <header className="mb-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title(prompt, state, props.cards, t)}</h2>
          {prompt.player === 1 && (
            <Badge tone="danger">
              <UserRound className="size-3" /> {t('prompt.opponent')}
            </Badge>
          )}
        </div>
        {prompt.hint && prompt.kind !== 'IDLE' && prompt.kind !== 'BATTLE' && (
          <p className="text-xs text-fg-subtle">{fillSystemText(prompt.hint, [])}</p>
        )}
      </header>
      <PromptBody {...props} prompt={prompt} onRespond={onRespond} />
    </section>
  );
}

function title(
  p: DuelPromptDto,
  state: DuelStateDto,
  cards: CardMap,
  t: ReturnType<typeof useTranslations<'duel'>>,
): string {
  switch (p.kind) {
    case 'IDLE':
    case 'BATTLE':
      return t(`phases.${state.phase}`);
    case 'CHAIN':
      return t('prompt.CHAIN.title');
    case 'YESNO':
      return p.text
        ? fillSystemText(
            p.text,
            p.card ? [cards[p.card.code]?.name ?? '', t(`locations.${p.card.location}`)] : [],
          )
        : t('prompt.YESNO.title');
    case 'OPTION':
      return t('prompt.OPTION.title');
    case 'SELECT_CARDS':
      return p.mode === 'SUM'
        ? t('prompt.SELECT_CARDS.SUM', { sum: p.sum ?? 0 })
        : t(`prompt.SELECT_CARDS.${p.mode}`);
    case 'SELECT_UNSELECT':
      return t('prompt.SELECT_UNSELECT.title');
    case 'PLACE':
      return p.disable
        ? t('prompt.PLACE.disable')
        : p.count > 1
          ? t('prompt.PLACE.titleMany', { count: p.count })
          : t('prompt.PLACE.title');
    case 'POSITION':
      return t('prompt.POSITION.title');
    case 'ANNOUNCE_NUMBER':
    case 'ANNOUNCE_RACE':
    case 'ANNOUNCE_ATTRIBUTE':
    case 'ANNOUNCE_CARD':
      return t(`prompt.${p.kind}.title`);
    case 'SORT':
      return t('prompt.SORT.title');
  }
}

function PromptBody(props: PanelProps & { prompt: DuelPromptDto }) {
  const { prompt } = props;
  // `key` : un nouvel état local à chaque invite
  switch (prompt.kind) {
    case 'IDLE':
    case 'BATTLE':
      return <PhaseActions {...props} prompt={prompt} />;
    case 'CHAIN':
      return <ChainChoice key={prompt.id} {...props} prompt={prompt} />;
    case 'YESNO':
      return <YesNo {...props} />;
    case 'OPTION':
      return (
        <div className="flex flex-col gap-1.5">
          {prompt.options.map((o) => (
            <Button
              key={o.index}
              variant="secondary"
              className="h-auto justify-start py-2 text-left"
              onClick={() => props.onRespond({ index: o.index })}
            >
              {o.text}
            </Button>
          ))}
        </div>
      );
    case 'SELECT_CARDS':
      return <SelectCards key={prompt.id} {...props} prompt={prompt} />;
    case 'SELECT_UNSELECT':
      return <SelectUnselect {...props} prompt={prompt} />;
    case 'PLACE':
      return <PlaceHint {...props} prompt={prompt} />;
    case 'POSITION':
      return <PositionChoice {...props} prompt={prompt} />;
    case 'ANNOUNCE_NUMBER':
      return (
        <div className="flex flex-wrap gap-1.5">
          {prompt.values.map((v, i) => (
            <Button
              key={i}
              variant="secondary"
              size="sm"
              className="font-mono"
              onClick={() => props.onRespond({ index: i })}
            >
              {v}
            </Button>
          ))}
        </div>
      );
    case 'ANNOUNCE_RACE':
    case 'ANNOUNCE_ATTRIBUTE':
      return <Announce key={prompt.id} {...props} prompt={prompt} />;
    case 'ANNOUNCE_CARD':
      return <AnnounceCard {...props} />;
    case 'SORT':
      return <Sort key={prompt.id} {...props} prompt={prompt} />;
  }
}

// MARK: - Phases

function PhaseActions({ prompt, onRespond }: PanelProps & { prompt: Prompt<'IDLE' | 'BATTLE'> }) {
  const t = useTranslations('duel');
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">{t(`prompt.${prompt.kind}`)}</p>
      <div className="flex flex-wrap gap-2">
        {prompt.kind === 'IDLE' && prompt.canBattle && (
          <Button size="sm" variant="secondary" onClick={() => onRespond({ phase: 'BATTLE' })}>
            {t('controls.battle')}
          </Button>
        )}
        {prompt.kind === 'BATTLE' && prompt.canMain2 && (
          <Button size="sm" variant="secondary" onClick={() => onRespond({ phase: 'MAIN2' })}>
            {t('controls.main2')}
          </Button>
        )}
        {prompt.canEnd && (
          <Button size="sm" onClick={() => onRespond({ phase: 'END' })}>
            {t('controls.end')}
          </Button>
        )}
      </div>
    </div>
  );
}

// MARK: - Choix simples

function YesNo({ onRespond }: PanelProps) {
  const t = useTranslations('duel.prompt.YESNO');
  return (
    <div className="flex gap-2">
      <Button className="flex-1" onClick={() => onRespond({ yes: true })}>
        {t('yes')}
      </Button>
      <Button className="flex-1" variant="secondary" onClick={() => onRespond({ yes: false })}>
        {t('no')}
      </Button>
    </div>
  );
}

function ChainChoice({
  prompt,
  cards,
  onRespond,
  onInspect,
}: PanelProps & { prompt: Prompt<'CHAIN'> }) {
  const t = useTranslations('duel.prompt.CHAIN');
  return (
    <div className="space-y-3">
      {prompt.forced && <p className="text-xs text-warning">{t('forced')}</p>}
      <ul className="flex flex-col gap-2">
        {prompt.options.map((o) => (
          <li
            key={o.index}
            className="flex items-center gap-3 rounded-xl border border-border bg-bg-sunken/50 p-2"
          >
            <button
              type="button"
              className="w-12 shrink-0"
              onClick={() => o.card.code && onInspect(o.card.code)}
            >
              <DuelCardFace card={o.card} cards={cards} sizes="48px" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{cards[o.card.code]?.name}</p>
              {o.description && (
                <p className="line-clamp-2 text-xs text-fg-muted">{o.description}</p>
              )}
            </div>
            <Button size="sm" onClick={() => onRespond({ index: o.index })}>
              <Check className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {!prompt.forced && (
        <Button variant="secondary" className="w-full" onClick={() => onRespond({ index: null })}>
          {t('pass')}
        </Button>
      )}
    </div>
  );
}

function PlaceHint({
  prompt,
  pickedCount,
  onResetPicks,
}: PanelProps & { prompt: Prompt<'PLACE'> }) {
  const t = useTranslations('duel.prompt.SELECT_CARDS');
  if (prompt.count <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-fg-muted">
      <span>{t('selected', { count: `${pickedCount}/${prompt.count}` })}</span>
      {pickedCount > 0 && (
        <Button size="sm" variant="ghost" onClick={onResetPicks}>
          <RotateCcw className="size-4" />
        </Button>
      )}
    </div>
  );
}

function PositionChoice({ prompt, cards, onRespond }: PanelProps & { prompt: Prompt<'POSITION'> }) {
  const t = useTranslations('duel.positions');
  return (
    <div className="grid grid-cols-2 gap-3">
      {prompt.positions.map((p: DuelPosition) => (
        <button
          key={p}
          type="button"
          onClick={() => onRespond({ position: p })}
          className="flex flex-col items-center gap-2 rounded-xl border border-border p-3 transition hover:border-accent hover:bg-accent/10"
        >
          <div className="flex h-24 items-center justify-center">
            <div className={cn('w-14', (p === 'DEF' || p === 'FD_DEF') && 'rotate-90')}>
              <DuelCardFace
                card={{ code: p === 'FD_ATK' || p === 'FD_DEF' ? 0 : prompt.code }}
                cards={cards}
                sizes="56px"
              />
            </div>
          </div>
          <span className="text-xs font-medium">{t(p)}</span>
        </button>
      ))}
    </div>
  );
}

// MARK: - Sélection de cartes

function ChoiceTile({
  choice,
  cards,
  selected,
  order,
  disabled,
  onClick,
}: {
  choice: DuelChoiceCard;
  cards: CardMap;
  selected: boolean;
  order?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const t = useTranslations('duel');
  const value = choice.value !== undefined ? choice.value & 0xffff : null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={cards[choice.card.code]?.name}
      className={cn(
        'group relative flex flex-col gap-1 rounded-lg p-1 text-left transition disabled:opacity-60',
        selected ? 'bg-accent/20 ring-2 ring-accent' : 'hover:bg-bg-sunken',
      )}
    >
      <DuelCardFace card={choice.card} cards={cards} sizes="80px" />
      <span className="truncate text-[10px] text-fg-subtle">
        {choice.card.controller === 1 ? `${t('board.opponent')} · ` : ''}
        {t(`locations.${choice.card.location}`)}
      </span>
      {value !== null && value > 0 && (
        <span className="absolute top-1.5 left-1.5 rounded bg-black/80 px-1 font-mono text-[10px] text-white">
          ★{value}
        </span>
      )}
      {order !== undefined && (
        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-accent-fg">
          {order}
        </span>
      )}
    </button>
  );
}

/** Sommes atteignables avec les valeurs choisies (une carte peut compter pour deux Niveaux). */
function reachableSums(values: number[]): Set<number> {
  let sums = new Set([0]);
  for (const v of values) {
    const options = [v & 0xffff, v >>> 16].filter((x, i) => i === 0 || x > 0);
    const next = new Set<number>();
    for (const s of sums) for (const o of options) next.add(s + o);
    sums = next;
  }
  return sums;
}

function SelectCards({
  prompt,
  cards,
  onRespond,
  onInspect,
}: PanelProps & { prompt: Prompt<'SELECT_CARDS'> }) {
  const t = useTranslations('duel.prompt');
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const values = (list: number[]) => list.map((i) => prompt.cards[i]?.value ?? 1);
  const mustValues = prompt.mustCards.map((c) => c.value ?? 0);
  const valid = useMemo(() => {
    if (prompt.mode === 'CARD') return picked.length >= prompt.min && picked.length <= prompt.max;
    if (prompt.mode === 'TRIBUTE') {
      // Certains monstres comptent pour 2 Sacrifices
      const total = values(picked).reduce((a, v) => a + Math.max(1, v), 0);
      return total >= prompt.min && picked.length <= prompt.max && picked.length > 0;
    }
    const sums = reachableSums([...mustValues, ...values(picked)]);
    return (
      [...sums].some((s) => s >= (prompt.sum ?? 0)) &&
      picked.length >= Math.max(0, prompt.min - prompt.mustCards.length)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, prompt]);

  const range =
    prompt.mode !== 'CARD'
      ? null
      : prompt.min === prompt.max
        ? t('range.exact', { count: prompt.min })
        : prompt.min === 0
          ? t('range.upTo', { max: prompt.max })
          : t('range.between', { min: prompt.min, max: prompt.max });
  const total =
    prompt.mode === 'SUM' ? Math.max(...reachableSums([...mustValues, ...values(picked)])) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-fg-muted">
        <span>{range}</span>
        <span className="font-mono">
          {total !== null
            ? t('SELECT_CARDS.total', { total, sum: prompt.sum ?? 0 })
            : t('SELECT_CARDS.selected', { count: String(picked.length) })}
        </span>
      </div>
      {prompt.mustCards.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] tracking-wide text-fg-subtle uppercase">
            {t('SELECT_CARDS.always')}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {prompt.mustCards.map((c) => (
              <ChoiceTile
                key={c.index}
                choice={c}
                cards={cards}
                selected
                disabled
                onClick={() => undefined}
              />
            ))}
          </div>
        </div>
      )}
      <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto">
        {prompt.cards.map((c) => (
          <ChoiceTile
            key={c.index}
            choice={c}
            cards={cards}
            selected={picked.includes(c.index)}
            onClick={() => {
              toggle(c.index);
              if (c.card.code) onInspect(c.card.code);
            }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!valid} onClick={() => onRespond({ indices: picked })}>
          {t('SELECT_CARDS.confirm')}
        </Button>
        {prompt.cancelable && (
          <Button variant="secondary" onClick={() => onRespond({ indices: null })}>
            {t('SELECT_CARDS.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

function SelectUnselect({
  prompt,
  cards,
  onRespond,
  onInspect,
}: PanelProps & { prompt: Prompt<'SELECT_UNSELECT'> }) {
  const t = useTranslations('duel.prompt.SELECT_UNSELECT');
  return (
    <div className="space-y-3">
      {prompt.unselectable.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] tracking-wide text-fg-subtle uppercase">{t('selected')}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {prompt.unselectable.map((c) => (
              <ChoiceTile
                key={c.index}
                choice={c}
                cards={cards}
                selected
                onClick={() => onRespond({ index: c.index })}
              />
            ))}
          </div>
        </div>
      )}
      <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto">
        {prompt.selectable.map((c) => (
          <ChoiceTile
            key={c.index}
            choice={c}
            cards={cards}
            selected={false}
            onClick={() => {
              if (c.card.code) onInspect(c.card.code);
              onRespond({ index: c.index });
            }}
          />
        ))}
      </div>
      {(prompt.canFinish || prompt.cancelable) && (
        <Button
          className="w-full"
          variant={prompt.canFinish ? 'primary' : 'secondary'}
          onClick={() => onRespond({ index: null })}
        >
          {prompt.canFinish ? t('finish') : t('cancel')}
        </Button>
      )}
    </div>
  );
}

function Sort({ prompt, cards, onRespond }: PanelProps & { prompt: Prompt<'SORT'> }) {
  const t = useTranslations('duel.prompt.SORT');
  const [clicked, setClicked] = useState<number[]>([]);
  const done = clicked.length === prompt.cards.length;
  // order[i] = rang voulu pour la carte i
  const order = () => {
    const ranks = new Array<number>(prompt.cards.length);
    clicked.forEach((cardIndex, rank) => (ranks[cardIndex] = rank));
    return ranks;
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">{t('hint')}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {prompt.cards.map((c) => {
          const rank = clicked.indexOf(c.index);
          return (
            <ChoiceTile
              key={c.index}
              choice={c}
              cards={cards}
              selected={rank >= 0}
              order={rank >= 0 ? rank + 1 : undefined}
              onClick={() => rank < 0 && setClicked((p) => [...p, c.index])}
            />
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!done} onClick={() => onRespond({ order: order() })}>
          {t('confirm')}
        </Button>
        {clicked.length > 0 ? (
          <Button variant="secondary" onClick={() => setClicked([])}>
            {t('reset')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => onRespond({ order: null })}>
            {t('keep')}
          </Button>
        )}
      </div>
    </div>
  );
}

// MARK: - Déclarations

function Announce({
  prompt,
  onRespond,
}: PanelProps & { prompt: Prompt<'ANNOUNCE_RACE' | 'ANNOUNCE_ATTRIBUTE'> }) {
  const t = useTranslations('duel');
  const [picked, setPicked] = useState<string[]>([]);
  const label = (v: string) =>
    prompt.kind === 'ANNOUNCE_RACE'
      ? t(`races.${v}` as 'races.WARRIOR')
      : t(`attributes.${v}` as 'attributes.EARTH');
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">{t('prompt.choose', { count: prompt.count })}</p>
      <div className="flex flex-wrap gap-1.5">
        {prompt.choices.map((v) => {
          const on = picked.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() =>
                setPicked((p) =>
                  on
                    ? p.filter((x) => x !== v)
                    : prompt.count === 1
                      ? [v]
                      : [...p, v].slice(-prompt.count),
                )
              }
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                on
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-border hover:border-border-strong',
              )}
            >
              {label(v)}
            </button>
          );
        })}
      </div>
      <Button
        className="w-full"
        disabled={picked.length !== prompt.count}
        onClick={() => onRespond({ values: picked })}
      >
        {t('prompt.confirm')}
      </Button>
    </div>
  );
}

function AnnounceCard({ onRespond }: PanelProps) {
  const t = useTranslations('duel.prompt.ANNOUNCE_CARD');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const search = useCardSearch({ q: query, page: 1, pageSize: 12 }, query.length >= 2);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-fg-subtle" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          className="pl-9"
        />
      </div>
      <div className="grid max-h-72 grid-cols-4 gap-1.5 overflow-y-auto">
        {search.data?.items.map((card) => (
          <button
            key={card.id}
            type="button"
            title={card.name}
            onClick={() => onRespond({ cardId: card.id })}
            className="rounded-lg p-1 transition hover:bg-bg-sunken"
          >
            <CardImage card={card} sizes="80px" />
          </button>
        ))}
      </div>
    </div>
  );
}
