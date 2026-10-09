'use client';
import type { DeckScoreDto } from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * La note d'un deck et son détail. Partagés : la même note se lit sur un deck suggéré et
 * sur un deck qu'on a écrit soi-même, et c'est tout l'intérêt qu'elle soit la même.
 */
export function ScoreBadge({ score }: { score: number }) {
  const t = useTranslations('suggestions.score');
  const tone =
    score >= 70
      ? 'text-success border-success/40'
      : score >= 50
        ? 'text-accent border-accent/40'
        : 'text-warning border-warning/40';
  return (
    <div
      className={cn('flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1', tone)}
      title={t('hint')}
    >
      <span className="font-mono text-lg leading-none font-bold tabular-nums">{score}</span>
      <span className="text-[9px]">{t('label')}</span>
    </div>
  );
}

type CriterionKey = 'engine' | 'synergy' | 'starters' | 'staples' | 'consistency' | 'filler';

/** Les critères de la note, en mots. */
export function ScoreBreakdown({ score }: { score: DeckScoreDto }) {
  const t = useTranslations('suggestions.score.criteria');
  const { percent, number } = useFormat();
  const item = (key: CriterionKey, value: string) => ({
    label: t(`${key}.label`),
    hint: t(`${key}.hint`),
    value,
  });
  const items = [
    item('engine', percent(score.engineShare)),
    ...(score.synergy !== null
      ? [item('synergy', percent(score.synergy)), item('starters', number(score.starters ?? 0))]
      : []),
    item('staples', number(score.staples)),
    item('consistency', percent(score.consistency)),
    item('filler', percent(score.fillerShare)),
  ];
  return (
    <dl className={cn('grid gap-1 text-center', items.length > 4 ? 'grid-cols-3' : 'grid-cols-4')}>
      {items.map((i) => (
        <div key={i.label} className="rounded-lg bg-bg-sunken/60 px-1 py-1.5" title={i.hint}>
          <dt className="text-[10px] text-fg-subtle">{i.label}</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
