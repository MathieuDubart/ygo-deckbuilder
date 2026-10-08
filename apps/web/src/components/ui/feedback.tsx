'use client';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg bg-bg-elevated', className)} />
);

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="pocket flex flex-col items-center justify-center gap-3 rounded-md px-6 py-12 text-center">
      <Icon className="size-7 text-ink-faint" strokeWidth={1.25} />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-[1.75rem] leading-none font-semibold md:text-[2.125rem]">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Les chiffres clés d'un écran, en une seule bande séparée par des filets — pas en trois
 * boîtes identiques. Le chiffre passe avant son libellé : c'est lui qu'on vient lire.
 */
/**
 * Intertitre de section. Un filet qui court sous le titre, comme la ligne d'un intercalaire :
 * ça sépare mieux qu'un libellé en capitales, et ça ne crie pas.
 */
export function SectionHeading({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-3 flex items-baseline justify-between gap-4 border-b border-edge pb-1.5',
        className,
      )}
    >
      <h2 className="text-sm font-medium text-ink-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Figures({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'mb-7 flex flex-wrap items-stretch gap-x-7 gap-y-4 border-y border-edge py-4',
        '[&>div+div]:border-l [&>div+div]:border-edge [&>div+div]:pl-7',
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  /** `gold` pour une valeur qui se mérite (collection complète, valeur estimée). */
  tone?: 'gold';
}) {
  return (
    <div className="min-w-24">
      <dd
        className={cn(
          'code text-[1.6rem] leading-none font-semibold',
          tone === 'gold' ? 'text-gold' : 'text-ink',
        )}
      >
        {value}
      </dd>
      <dt className="mt-1.5 text-xs text-ink-faint">{label}</dt>
    </div>
  );
}

/**
 * Jauge d'avancement. Le ton suit l'état plutôt que la valeur : complet en vert, entamé en
 * couleur d'accent, rien en gris — on lit l'état d'un coup d'œil sans lire le chiffre.
 */
export function Meter({
  value,
  total,
  title,
  className,
}: {
  value: number;
  total: number;
  title?: string;
  className?: string;
}) {
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  // L'or est réservé à ce qui se mérite : une extension bouclée en fait partie.
  const tone = ratio >= 1 ? 'bg-gold' : ratio > 0 ? 'bg-ink-muted' : 'bg-transparent';
  return (
    <div
      className={cn('pocket h-1 overflow-hidden rounded-xs', className)}
      title={title}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className={cn('h-full transition-[width] duration-500', tone)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const t = useTranslations('common.pagination');
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label={t('label')}>
      <button
        className="rounded-md px-3 py-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-30"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {t('previous')}
      </button>
      <span className="code text-ink-faint">
        {page} / {totalPages}
      </span>
      <button
        className="rounded-md px-3 py-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-30"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        {t('next')}
      </button>
    </nav>
  );
}
