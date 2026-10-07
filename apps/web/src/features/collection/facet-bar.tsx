'use client';
import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FacetOption {
  value: string;
  label: string;
  count?: number;
}

export interface Facet {
  key: string;
  /** Libellé accessible du menu (jamais affiché : la valeur « tout » tient ce rôle). */
  label: string;
  /** Option affichée quand aucune valeur n'est choisie. */
  allLabel: string;
  value: string | undefined;
  options: FacetOption[];
  onChange: (value: string | undefined) => void;
}

/**
 * Barre de filtres d'un onglet de la collection : une recherche, des facettes cumulables, et
 * ce que l'appelant veut y ajouter (tri, bascules, étiquettes). Une facette sans valeur
 * disponible n'est pas affichée — on ne propose jamais un filtre qui ne renverrait rien.
 */
export function FacetBar({
  search,
  facets,
  children,
  className,
}: {
  search?: { value: string; placeholder: string; onChange: (value: string) => void };
  facets: Facet[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {search && (
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            type="search"
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="pl-9"
            autoComplete="off"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {facets
          .filter((facet) => facet.options.length > 0)
          .map((facet) => (
            <Select
              key={facet.key}
              aria-label={facet.label}
              value={facet.value ?? ''}
              onChange={(e) => facet.onChange(e.target.value || undefined)}
              className="w-auto max-w-52"
            >
              <option value="">{facet.allLabel}</option>
              {facet.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.count === undefined ? option.label : `${option.label} (${option.count})`}
                </option>
              ))}
            </Select>
          ))}
        {children}
      </div>
    </div>
  );
}

/** Interrupteur discret, à côté des facettes. */
export function FilterToggle({
  checked,
  onChange,
  children,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <label
      title={title}
      className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg-sunken px-3 text-xs font-medium text-fg-muted has-checked:border-accent/50 has-checked:text-accent"
    >
      <input
        type="checkbox"
        className="accent-(--accent)"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
