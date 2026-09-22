'use client';
import type { DuelEventDto } from '@ygo/shared';
import { FastForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DuelCardFace } from '../duel-card';
import { cardName, type CardMap } from '../duel-utils';
import type { FxFrame } from '../use-duel';

type Side = 0 | 1;
const tint = (player: Side) => (player === 0 ? 'var(--accent)' : 'var(--trap)');

/**
 * Scène posée sur le terrain pendant le replay : plans « cinématiques » (Invocations,
 * activations, attaques, tour), et effets discrets (dégâts qui flottent, pioche, phase).
 * Un toucher n'importe où accélère (« Passer »).
 */
export function FxStage({
  frame,
  cards,
  onSkip,
}: {
  frame: FxFrame | null;
  cards: CardMap;
  onSkip: () => void;
}) {
  const t = useTranslations('duel.fx');
  if (!frame) return null;
  const style = { '--fx-dur': `${frame.duration}ms` } as CSSProperties;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl"
      style={style}
    >
      <Scene key={frame.id} event={frame.event} cards={cards} />
      <button
        type="button"
        onClick={onSkip}
        className="pointer-events-auto absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/85"
      >
        <FastForward className="size-3.5" /> {t('skip')}
      </button>
    </div>
  );
}

function Scene({ event, cards }: { event: FxFrame['event']; cards: CardMap }) {
  const t = useTranslations('duel');
  const name = (code: number) => cardName(cards, code) ?? t('log.hidden');

  switch (event.kind) {
    case 'DUEL_START':
      return (
        <Band color="var(--accent)">
          <p className="fx-title text-5xl font-black tracking-wider text-white italic drop-shadow-[0_0_24px_var(--accent)] sm:text-7xl">
            {t('fx.duel')}
          </p>
        </Band>
      );
    case 'TURN':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="fx-banner w-[130%] py-5 text-center shadow-2xl"
            style={{
              background: `linear-gradient(90deg, transparent, color-mix(in oklch, ${tint(event.player)} 85%, black), transparent)`,
            }}
          >
            <p className="text-xs font-semibold tracking-[0.3em] text-white/80 uppercase">
              {t('board.turn', { turn: event.turn })}
            </p>
            <p className="text-4xl font-black tracking-wide text-white uppercase italic sm:text-5xl">
              {event.player === 0 ? t('board.yourTurn') : t('board.opponentTurn')}
            </p>
          </div>
        </div>
      );
    case 'SUMMON':
      return (
        <CutIn
          player={event.player}
          code={event.code}
          cards={cards}
          label={t(`fx.summon.${event.how}`)}
          title={name(event.code)}
          rays={event.how === 'SPECIAL'}
        />
      );
    case 'ACTIVATE':
      return (
        <CutIn
          player={event.player}
          code={event.code}
          cards={cards}
          label={t('fx.activate', { link: event.chainLink })}
          title={name(event.code)}
          text={event.description}
          accent="var(--spell)"
        />
      );
    case 'CHAIN_NEGATED':
      return (
        <Band color="var(--danger)">
          <div className="relative">
            <p className="fx-title text-4xl font-black tracking-widest text-white uppercase sm:text-6xl">
              {t('fx.negated')}
            </p>
            <div className="fx-slash absolute top-1/2 -left-8 -right-8 h-2 -rotate-6 bg-danger shadow-[0_0_20px_var(--danger)]" />
          </div>
          <p className="mt-2 text-sm text-white/80">
            {t('log.CHAIN_NEGATED', { link: event.chainLink })}
          </p>
        </Band>
      );
    case 'ATTACK':
      return <Attack event={event} cards={cards} name={name} />;
    case 'COIN':
    case 'DICE':
      return (
        <Band color="var(--accent)">
          <div className="flex gap-4 [perspective:600px]">
            {event.results.map((r, i) => (
              <div
                key={i}
                className="fx-spin flex size-16 items-center justify-center rounded-full border-4 border-accent bg-accent/30 text-2xl font-black text-white shadow-[0_0_30px_var(--accent)]"
                style={event.kind === 'DICE' ? { borderRadius: '14px' } : undefined}
              >
                {event.kind === 'DICE' ? String(r) : r ? '★' : '☾'}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            {event.kind === 'COIN'
              ? event.results.map((h) => t(h ? 'log.heads' : 'log.tails')).join(', ')
              : event.results.join(', ')}
          </p>
        </Band>
      );
    case 'DAMAGE':
    case 'RECOVER':
      return <LifePoints event={event} />;
    case 'PHASE':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="fx-pill rounded-full border border-white/15 bg-black/75 px-4 py-1.5 text-sm font-semibold tracking-wide text-white uppercase backdrop-blur">
            {t(`phases.${event.phase}`)}
          </span>
        </div>
      );
    case 'DRAW':
      return (
        <Corner player={event.player}>
          <span className="fx-float flex items-center gap-2 rounded-full bg-black/75 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
            <span className="flex -space-x-3">
              {Array.from({ length: Math.min(event.count, 5) }, (_, i) => (
                <DuelCardFace
                  key={i}
                  card={{ code: event.codes[i] ?? 0 }}
                  cards={cards}
                  className="w-6"
                />
              ))}
            </span>
            +{event.count}
          </span>
        </Corner>
      );
    case 'SET':
      return (
        <Corner player={event.player}>
          <span className="fx-float rounded-full bg-black/75 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
            {t('fx.set')}
          </span>
        </Corner>
      );
    case 'MOVE':
      return (
        <Corner player={event.player}>
          <span className="fx-float flex items-center gap-2 rounded-full bg-black/75 py-1 pr-3 pl-1 text-sm text-white backdrop-blur">
            <DuelCardFace card={{ code: event.code }} cards={cards} className="w-7 grayscale" />
            <span className="max-w-40 truncate font-medium">{name(event.code)}</span>
            <span className="text-white/60">→ {t(`locations.${event.to}`)}</span>
          </span>
        </Corner>
      );
    default:
      return null;
  }
}

/** Bandeau sombre en travers du terrain, contenu centré. */
function Band({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="fx-band absolute inset-x-0 top-1/2 h-[58%] -translate-y-1/2"
        style={{
          background: `linear-gradient(180deg, transparent, color-mix(in oklch, ${color} 22%, oklch(0.1 0 0 / 0.88)) 18%, color-mix(in oklch, ${color} 22%, oklch(0.1 0 0 / 0.88)) 82%, transparent)`,
        }}
      />
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

/** Plan d'une carte : visuel qui jaillit, halo, rayons (Invocation Spéciale), légende. */
function CutIn({
  player,
  code,
  cards,
  label,
  title,
  text,
  rays,
  accent,
}: {
  player: Side;
  code: number;
  cards: CardMap;
  label: string;
  title: string;
  text?: string | null;
  rays?: boolean;
  accent?: string;
}) {
  const color = accent ?? tint(player);
  return (
    <Band color={color}>
      <div className={cn('flex items-center gap-5 px-4', player === 1 && 'flex-row-reverse')}>
        <div className="relative">
          {rays && (
            <div
              className="fx-rays absolute -inset-16 rounded-full"
              style={{
                background: `repeating-conic-gradient(from 0deg, color-mix(in oklch, ${color} 55%, transparent) 0deg 8deg, transparent 8deg 22deg)`,
                maskImage: 'radial-gradient(circle, black 20%, transparent 70%)',
              }}
            />
          )}
          <div
            className="fx-cutin relative w-28 sm:w-36"
            style={{ filter: `drop-shadow(0 0 22px ${color})` }}
          >
            <DuelCardFace card={{ code }} cards={cards} sizes="160px" />
          </div>
        </div>
        <div className={cn('fx-title max-w-56 space-y-1', player === 1 && 'text-right')}>
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase" style={{ color }}>
            {label}
          </p>
          <p className="text-lg leading-tight font-bold text-white sm:text-xl">{title}</p>
          {text && <p className="line-clamp-3 text-xs leading-snug text-white/70">{text}</p>}
        </div>
      </div>
    </Band>
  );
}

function Attack({
  event,
  cards,
  name,
}: {
  event: Extract<DuelEventDto, { kind: 'ATTACK' }>;
  cards: CardMap;
  name: (code: number) => string;
}) {
  const t = useTranslations('duel.fx');
  const flip = event.player === 1;
  return (
    <Band color="var(--danger)">
      <p className="fx-title mb-3 text-xs font-bold tracking-[0.3em] text-danger uppercase">
        {event.target ? t('attack') : t('direct')}
      </p>
      <div className={cn('flex items-center gap-10 sm:gap-16', flip && 'flex-row-reverse')}>
        <div className={cn('fx-lunge relative z-10 w-24 sm:w-28', flip && '-scale-x-100')}>
          <div className={cn(flip && '-scale-x-100')}>
            <DuelCardFace card={{ code: event.code }} cards={cards} sizes="120px" />
          </div>
        </div>
        <div className="relative w-24 sm:w-28">
          {event.target ? (
            <div className="fx-recoil">
              <DuelCardFace card={{ code: event.target }} cards={cards} sizes="120px" />
            </div>
          ) : (
            <div className="fx-recoil flex aspect-(--aspect-card) flex-col items-center justify-center rounded-lg border-2 border-danger/60 bg-danger/15 text-white">
              <span className="text-xs tracking-widest uppercase">
                {flip ? t('you') : t('opponent')}
              </span>
              <span className="text-2xl font-black">LP</span>
            </div>
          )}
          <div className="fx-hit absolute inset-0 m-auto size-24 rounded-full bg-[radial-gradient(circle,white,color-mix(in_oklch,var(--danger)_70%,transparent)_40%,transparent_70%)]" />
        </div>
      </div>
      <p className="mt-3 max-w-72 truncate text-center text-sm text-white/80">
        {name(event.code)}
        {event.target ? ` ⚔ ${name(event.target)}` : ''}
      </p>
    </Band>
  );
}

function LifePoints({ event }: { event: Extract<DuelEventDto, { kind: 'DAMAGE' | 'RECOVER' }> }) {
  const damage = event.kind === 'DAMAGE';
  const big = damage && !event.cost && event.amount >= 1000;
  return (
    <>
      {damage && !event.cost && (
        <div
          className="fx-vignette absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at ${event.player === 0 ? 'bottom' : 'top'}, color-mix(in oklch, var(--danger) 45%, transparent), transparent 65%)`,
          }}
        />
      )}
      <Corner player={event.player}>
        <span
          className={cn(
            'fx-float font-mono font-black tabular-nums drop-shadow-[0_2px_8px_black]',
            big ? 'text-5xl' : 'text-3xl',
            damage ? 'text-danger' : 'text-success',
          )}
        >
          {damage ? '−' : '+'}
          {event.amount}
        </span>
      </Corner>
    </>
  );
}

/** Coin du joueur : en bas pour toi, en haut pour l'adversaire. */
function Corner({ player, children }: { player: Side; children: ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 flex justify-center',
        player === 0 ? 'bottom-[18%]' : 'top-[14%]',
      )}
    >
      {children}
    </div>
  );
}
