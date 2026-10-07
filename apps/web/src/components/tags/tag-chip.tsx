'use client';
import type { TagColor, TagDto } from '@ygo/shared';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pastille d'étiquette. La couleur stockée est un slug, jamais une valeur CSS : le thème
 * reste maître de ses teintes, en clair comme en sombre.
 */
const COLORS: Record<TagColor, string> = {
  slate: 'bg-fg-muted/15 text-fg-muted border-fg-muted/30',
  red: 'bg-danger/15 text-danger border-danger/30',
  amber: 'bg-warning/15 text-warning border-warning/30',
  green: 'bg-success/15 text-success border-success/30',
  teal: 'bg-teal-500/15 text-teal-600 border-teal-500/30 dark:text-teal-400',
  blue: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
  violet: 'bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400',
  pink: 'bg-pink-500/15 text-pink-600 border-pink-500/30 dark:text-pink-400',
};

export const tagColorClass = (color: TagColor) => COLORS[color] ?? COLORS.slate;

export function TagChip({
  tag,
  active,
  count,
  onClick,
  onRemove,
  className,
}: {
  tag: TagDto;
  /** Rendu « sélectionné » : fond plein plutôt que teinté. */
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {active && <Check className="size-3 shrink-0" />}
      <span className="truncate">{tag.name}</span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
      )}
    </>
  );
  const base = cn(
    'inline-flex max-w-44 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
    tagColorClass(tag.color),
    active && 'ring-1 ring-current ring-inset',
    className,
  );

  if (onRemove) {
    return (
      <span className={base}>
        {content}
        <button
          type="button"
          onClick={onRemove}
          aria-label={tag.name}
          className="-mr-0.5 rounded-full p-0.5 opacity-60 transition hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      </span>
    );
  }
  if (!onClick) return <span className={base}>{content}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(base, 'transition hover:brightness-110')}
    >
      {content}
    </button>
  );
}
