'use client';
import type { DuelEventDto } from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { cardName, type CardMap } from './duel-utils';

/** Journal du duel, composé dans la langue de l'utilisateur (le plus récent en bas). */
export function DuelLog({
  events,
  cards,
  onInspect,
}: {
  events: DuelEventDto[];
  cards: CardMap;
  onInspect: (code: number) => void;
}) {
  const t = useTranslations('duel.log');
  const tp = useTranslations('duel');
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [events.length]);

  const who = (p: 0 | 1) => (p === 0 ? 'you' : 'opponent');
  const name = (code: number) => cardName(cards, code) ?? t('hidden');
  /** Nom cliquable (balise <c> / <t> des messages) */
  const link = (code: number) => (chunks: React.ReactNode) =>
    code ? (
      <button
        type="button"
        onClick={() => onInspect(code)}
        className="font-medium text-fg underline decoration-border-strong underline-offset-2 hover:decoration-accent"
      >
        {chunks}
      </button>
    ) : (
      <span className="italic">{chunks}</span>
    );

  const line = (e: DuelEventDto): React.ReactNode => {
    switch (e.kind) {
      case 'TURN':
        return t('TURN', { turn: e.turn, player: who(e.player) });
      case 'PHASE':
        return tp(`phases.${e.phase}`);
      case 'DRAW':
        return e.codes.length
          ? t('DRAW', { player: who(e.player), cards: e.codes.map(name).join(', ') })
          : t('DRAW_hidden', { player: who(e.player), count: e.count });
      case 'SUMMON':
        return t.rich(`SUMMON_${e.how}`, {
          player: who(e.player),
          card: name(e.code),
          c: link(e.code),
        });
      case 'SET':
        return t('SET', { player: who(e.player) });
      case 'ACTIVATE':
        return (
          <>
            {t.rich('ACTIVATE', {
              link: e.chainLink,
              player: who(e.player),
              card: name(e.code),
              c: link(e.code),
            })}
            {e.description && <span className="block text-fg-subtle">{e.description}</span>}
          </>
        );
      case 'CHAIN_NEGATED':
        return t('CHAIN_NEGATED', { link: e.chainLink });
      case 'MOVE':
        return t.rich('MOVE', {
          card: name(e.code),
          c: link(e.code),
          from: tp(`locations.${e.from}`),
          to: tp(`locations.${e.to}`),
        });
      case 'ATTACK':
        return e.target
          ? t.rich('ATTACK', {
              card: name(e.code),
              c: link(e.code),
              target: name(e.target),
              t: link(e.target),
            })
          : t.rich('ATTACK_direct', { card: name(e.code), c: link(e.code) });
      case 'DAMAGE':
        return t(e.cost ? 'DAMAGE_cost' : 'DAMAGE', { player: who(e.player), amount: e.amount });
      case 'RECOVER':
        return t('RECOVER', { player: who(e.player), amount: e.amount });
      case 'COIN':
        return t('COIN', { results: e.results.map((h) => t(h ? 'heads' : 'tails')).join(', ') });
      case 'DICE':
        return t('DICE', { results: e.results.join(', ') });
      case 'WIN':
        return e.winner === null ? t('WIN_draw') : t('WIN', { player: who(e.winner) });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
        {t('title')}
      </h2>
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-xs leading-relaxed text-fg-muted">
        {!events.length && <li className="text-fg-subtle">{t('empty')}</li>}
        {events.map((e) => (
          <li
            key={`${e.turn}-${e.seq}`}
            className={cn(
              e.kind === 'TURN' &&
                'mt-3 border-t border-border pt-2 font-semibold text-fg first:mt-0 first:border-0 first:pt-0',
              e.kind === 'PHASE' && 'text-[10px] tracking-wide text-fg-subtle uppercase',
              e.kind === 'DAMAGE' && 'text-danger',
              e.kind === 'RECOVER' && 'text-success',
              e.kind === 'WIN' && 'font-semibold text-accent',
            )}
          >
            {line(e)}
          </li>
        ))}
        <li ref={end} aria-hidden />
      </ol>
    </div>
  );
}
