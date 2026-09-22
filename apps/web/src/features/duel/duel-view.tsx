'use client';
import type {
  CreateDuelInput,
  DuelActionDto,
  DuelCardRef,
  DuelChainPrompts,
  DuelPhase,
  DuelStateDto,
} from '@ygo/shared';
import { DUEL_CHAIN_PROMPTS, DUEL_PHASES } from '@ygo/shared';
import { BookOpen, LogOut, RotateCcw, Swords, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/feedback';
import { useDuelEngine } from '@/lib/api/duel';
import { SOURCE_URL } from '@/lib/source';
import { cn } from '@/lib/utils';
import { ActionMenu } from './action-menu';
import { CardInspector } from './card-inspector';
import { DuelBoard, type Pile, type ZoneRef } from './duel-board';
import { DuelLog } from './duel-log';
import { defaultSetup, DuelSetup } from './duel-setup';
import { actionsByCard, placeableZones, refKey } from './duel-utils';
import { PileDialog } from './pile-dialog';
import { PromptPanel } from './prompt-panel';
import { useDuelSession, type DuelSession } from './use-duel';

export function DuelView() {
  const t = useTranslations('duel');
  const engine = useDuelEngine();
  const session = useDuelSession();
  const [setup, setSetup] = useState<CreateDuelInput | null>(null);

  // Formulaire pré-rempli avec la dernière configuration (rechargement, « nouvelle config »)
  const form = setup ?? session.lastSetup ?? defaultSetup();

  const header = <PageHeader title={t('page.title')} description={t('page.description')} />;

  if (engine.isLoading || session.resuming)
    return (
      <>
        {header}
        <Skeleton className="h-[32rem]" />
      </>
    );

  if (!engine.data?.ready)
    return (
      <>
        {header}
        <EmptyState
          icon={Swords}
          title={engine.data?.downloading ? t('engine.loading') : t('engine.unavailable')}
          description={
            engine.data?.downloading ? t('engine.downloading') : (engine.data?.error ?? undefined)
          }
        />
      </>
    );

  if (!session.state)
    return (
      <>
        {header}
        <DuelSetup
          value={form}
          onChange={setSetup}
          busy={session.busy}
          onStart={() => session.start(form)}
        />
        <p className="mt-6 text-center text-xs text-fg-subtle">
          {t('engine.stats', { cards: engine.data.cards, scripts: engine.data.scripts })} · EDOPro /
          Project Ignis ·{' '}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-fg">
            {t('page.source')}
          </a>
        </p>
      </>
    );

  return <DuelTable session={session as DuelSession & { state: DuelStateDto }} />;
}

// MARK: - Table de jeu

function DuelTable({ session }: { session: DuelSession & { state: DuelStateDto } }) {
  const t = useTranslations('duel');
  const { state, cards, log, busy, respond } = session;
  const [menu, setMenu] = useState<{ anchor: HTMLElement; card: DuelCardRef } | null>(null);
  const [pile, setPile] = useState<{ controller: 0 | 1; pile: Pile } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const [picks, setPicks] = useState<ZoneRef[]>([]);
  const [resultOpen, setResultOpen] = useState(true);

  const promptId = state.prompt?.id;
  const actions = useMemo(() => actionsByCard(state.prompt), [state.prompt]);
  const placeable = useMemo(() => placeableZones(state.prompt), [state.prompt]);
  const picked = useMemo(() => new Set(picks.map(refKey)), [picks]);

  // Nouvelle invite : on referme les menus, on oublie les zones choisies
  useEffect(() => {
    setMenu(null);
    setPile(null);
    setPicks([]);
  }, [promptId]);
  useEffect(() => setResultOpen(true), [state.finished]);

  const inspect = useCallback((code: number) => {
    if (window.matchMedia('(min-width: 1024px)').matches) setPinned(code);
    else setSheet(code);
  }, []);

  const act = (a: DuelActionDto) => {
    setMenu(null);
    setPile(null);
    respond({ action: { kind: a.kind, index: a.index } });
  };

  const onCard = (card: DuelCardRef, anchor: HTMLElement) => {
    if (busy) return;
    if (actions.has(refKey(card))) setMenu({ anchor, card });
    else if (card.code) inspect(card.code);
  };

  const onZone = (zone: ZoneRef) => {
    const p = state.prompt;
    if (p?.kind !== 'PLACE' || busy) return;
    const next = [...picks.filter((z) => refKey(z) !== refKey(zone)), zone];
    if (next.length >= p.count) respond({ zones: next.slice(0, p.count) });
    else setPicks(next);
  };

  const pileList = pile
    ? state.players[pile.controller][
        pile.pile === 'GRAVE' ? 'grave' : pile.pile === 'BANISHED' ? 'banished' : 'extra'
      ]
    : [];
  const shown = hover ?? pinned;

  return (
    // Sur mobile, l'invite est un panneau fixé en bas : on laisse de la place pour défiler
    <div className="space-y-4 pb-64 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TurnStrip state={state} busy={busy} />
        <div className="flex flex-wrap items-center gap-2">
          <ChainToggle
            value={state.chainPrompts}
            disabled={busy}
            onChange={session.setChainPrompts}
          />
          <Link
            href="/rules"
            target="_blank"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm text-fg-muted hover:bg-bg-elevated hover:text-fg"
          >
            <BookOpen className="size-4" /> {t('page.rules')}
          </Link>
          {session.lastSetup && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => session.start(session.lastSetup!)}
            >
              <RotateCcw className="size-4" /> {t('controls.restart')}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={session.leave}>
            <LogOut className="size-4" /> {t('controls.leave')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_19rem] xl:grid-cols-[16rem_minmax(0,1fr)_21rem]">
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <CardInspector card={shown ? (cards[shown] ?? null) : null} />
          </div>
        </aside>

        <div className="relative min-w-0">
          <DuelBoard
            state={state}
            cards={cards}
            actions={actions}
            placeable={placeable}
            picked={picked}
            onCard={onCard}
            onZone={onZone}
            onPile={(controller, p) => setPile({ controller, pile: p })}
            onHover={setHover}
          />
          {state.finished && resultOpen && (
            <ResultOverlay
              state={state}
              onRematch={session.lastSetup ? () => session.start(session.lastSetup!) : null}
              onNewSetup={session.leave}
              onReview={() => setResultOpen(false)}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
          <div className="fixed inset-x-2 bottom-[4.75rem] z-30 max-h-[55dvh] overflow-y-auto rounded-2xl md:bottom-4 md:left-auto md:w-96 lg:static lg:max-h-none lg:w-auto lg:overflow-visible">
            <PromptPanel
              state={state}
              cards={cards}
              busy={busy}
              pickedCount={picks.length}
              onResetPicks={() => setPicks([])}
              onRespond={respond}
              onInspect={inspect}
            />
          </div>
          <div className="h-72 rounded-2xl border border-border bg-bg-elevated p-4 lg:min-h-0 lg:flex-1">
            <DuelLog events={log} cards={cards} onInspect={inspect} />
          </div>
        </div>
      </div>

      {menu && (
        <ActionMenu
          anchor={menu.anchor}
          actions={actions.get(refKey(menu.card)) ?? []}
          onAction={act}
          onInspect={
            menu.card.code
              ? () => {
                  inspect(menu.card.code);
                  setMenu(null);
                }
              : null
          }
          onClose={() => setMenu(null)}
        />
      )}
      <PileDialog
        open={!!pile}
        title={
          pile
            ? `${pile.controller === 0 ? t('board.you') : t('board.opponent')} · ${t(`board.${pile.pile === 'GRAVE' ? 'grave' : pile.pile === 'BANISHED' ? 'banished' : 'extra'}`)}`
            : ''
        }
        list={pileList}
        cards={cards}
        actions={actions}
        onAction={act}
        onInspect={inspect}
        onClose={() => setPile(null)}
      />
      <Dialog
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet ? (cards[sheet]?.name ?? '') : ''}
        variant="sheet"
      >
        <CardInspector card={sheet ? (cards[sheet] ?? null) : null} />
      </Dialog>
    </div>
  );
}

function ChainToggle({
  value,
  disabled,
  onChange,
}: {
  value: DuelChainPrompts;
  disabled: boolean;
  onChange: (v: DuelChainPrompts) => void;
}) {
  const t = useTranslations('duel.controls.chains');
  return (
    <div className="flex items-center gap-2 text-xs text-fg-muted" title={t('hint')}>
      <span>{t('label')}</span>
      <div className="flex rounded-lg border border-border bg-bg-sunken p-0.5">
        {DUEL_CHAIN_PROMPTS.map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            aria-pressed={value === mode}
            onClick={() => value !== mode && onChange(mode)}
            className={cn(
              'rounded-md px-2 py-1 font-medium transition',
              value === mode ? 'bg-bg-elevated text-fg shadow-sm' : 'hover:text-fg',
            )}
          >
            {t(mode)}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnStrip({ state, busy }: { state: DuelStateDto; busy: boolean }) {
  const t = useTranslations('duel');
  const current: DuelPhase = state.phase;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="text-sm">
        <span className="font-semibold">{t('board.turn', { turn: state.turn })}</span>
        <span className={cn('ml-2', state.turnPlayer === 0 ? 'text-accent' : 'text-trap')}>
          {state.turnPlayer === 0 ? t('board.yourTurn') : t('board.opponentTurn')}
        </span>
      </div>
      <ol className="flex rounded-lg border border-border bg-bg-sunken p-0.5">
        {DUEL_PHASES.map((p) => (
          <li
            key={p}
            title={t(`phases.${p}`)}
            className={cn(
              'rounded-md px-2 py-1 font-mono text-[11px] font-semibold',
              p === current ? 'bg-accent text-accent-fg' : 'text-fg-subtle',
            )}
          >
            {t(`phaseShort.${p}`)}
          </li>
        ))}
      </ol>
      {busy && (
        <span className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {t('controls.thinking')}
        </span>
      )}
    </div>
  );
}

function ResultOverlay({
  state,
  onRematch,
  onNewSetup,
  onReview,
}: {
  state: DuelStateDto;
  onRematch: (() => void) | null;
  onNewSetup: () => void;
  onReview: () => void;
}) {
  const t = useTranslations('duel.result');
  const winner = state.finished?.winner ?? null;
  const label = winner === null ? t('draw') : winner === 0 ? t('win') : t('lose');
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-bg/70 backdrop-blur-sm">
      <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border-strong bg-bg-elevated p-6 text-center shadow-2xl">
        <Trophy className={cn('size-10', winner === 0 ? 'text-accent' : 'text-fg-subtle')} />
        <p className="text-2xl font-semibold">{label}</p>
        {state.finished?.reason && <p className="text-sm text-fg-muted">{state.finished.reason}</p>}
        <div className="mt-2 flex w-full flex-col gap-2">
          {onRematch && <Button onClick={onRematch}>{t('rematch')}</Button>}
          <Button variant="secondary" onClick={onNewSetup}>
            {t('newSetup')}
          </Button>
          <Button variant="ghost" onClick={onReview}>
            {t('review')}
          </Button>
        </div>
      </div>
    </div>
  );
}
