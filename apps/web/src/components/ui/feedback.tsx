import type { LucideIcon } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <Icon className="size-8 text-fg-subtle" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-xs tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
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
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      <button
        className="rounded-md px-3 py-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-30"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Précédent
      </button>
      <span className="font-mono text-fg-subtle tabular-nums">
        {page} / {totalPages}
      </span>
      <button
        className="rounded-md px-3 py-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-30"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Suivant →
      </button>
    </nav>
  );
}
