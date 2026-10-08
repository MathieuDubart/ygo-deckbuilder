'use client';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Effectif affiché à droite du libellé, quand il aide à choisir. */
  count?: number;
}

/**
 * Les intercalaires d'un classeur. L'onglet actif n'est pas « surligné » : il est la page
 * elle-même qui remonte, et il mange le filet du bas pour se raccorder au contenu. Les autres
 * restent en retrait, dans la tranche. C'est la métaphore que tout le monde connaît déjà avec
 * les doigts, donc rien à apprendre.
 */
export function DividerTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex items-end gap-1 border-b border-edge', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center gap-2 rounded-t-xs px-4 text-sm transition-colors',
              active
                ? // `-mb-px` : l'onglet recouvre le filet du conteneur, donc il s'y raccorde
                  '-mb-px border border-edge border-b-sheet bg-sheet py-2.5 font-medium text-ink'
                : 'mt-1 py-2 text-ink-faint hover:text-ink-muted',
            )}
          >
            {Icon && <Icon className="size-4" strokeWidth={active ? 2 : 1.5} />}
            {item.label}
            {item.count !== undefined && (
              <span className="code text-xs text-ink-faint">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
