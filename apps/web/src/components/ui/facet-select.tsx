'use client';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FacetChoice {
  value: string;
  label: string;
  count?: number;
}

/**
 * Une facette se lit comme une étiquette d'intercalaire : discrète tant qu'elle ne filtre
 * rien, à l'encre inversée dès qu'elle porte une valeur. Pas de cadre — une rangée de cadres
 * pèse plus lourd que le contenu qu'elle trie, et c'est le contenu qu'on vient voir.
 */
export function FacetSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
  /** Valeur montrée dans le champ quand elle diffère de la valeur « qui filtre » (tri). */
  shown,
  className,
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: readonly FacetChoice[];
  onChange: (value: string | undefined) => void;
  shown?: string;
  className?: string;
}) {
  const active = value !== undefined && value !== '';
  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <select
        aria-label={label}
        value={shown ?? value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={cn(
          'h-8 max-w-52 cursor-pointer appearance-none rounded-xs border-0 bg-transparent py-0 pr-6 pl-2',
          'text-xs font-medium outline-none',
          active ? 'bg-label text-label-ink' : 'text-ink-muted hover:text-ink',
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.count === undefined ? option.label : `${option.label} (${option.count})`}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-1.5 size-3',
          active ? 'text-label-ink' : 'text-ink-faint',
        )}
      />
    </span>
  );
}
