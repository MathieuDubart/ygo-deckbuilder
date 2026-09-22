'use client';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Pourcentage compact (sans espace) pour les badges et l'anneau. */
export const compact = (s: string) => s.replace(/\s/g, '');

/** Anneau de couverture : part de la liste de référence déjà possédée. */
export function CoverageRing({ value }: { value: number }) {
  const t = useTranslations('suggestions.meta.card');
  const { percent } = useFormat();
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = value >= 0.8 ? 'text-success' : value >= 0.5 ? 'text-accent' : 'text-fg-subtle';
  return (
    <div className="relative size-12 shrink-0" title={t('coverage')}>
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className={cn('stroke-current transition-all', tone)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold tabular-nums">
        {compact(percent(value))}
      </span>
    </div>
  );
}
