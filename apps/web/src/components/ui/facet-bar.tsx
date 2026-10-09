'use client';
import { Search } from 'lucide-react';
import { FacetSelect } from '@/components/ui/facet-select';
import { Input } from '@/components/ui/input';
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
 * Barre de filtres d'une liste : une recherche, des facettes cumulables, et ce que
 * l'appelant veut y ajouter (tri, bascules, étiquettes). Une facette sans valeur disponible
 * n'est pas affichée — on ne propose jamais un filtre qui ne renverrait rien.
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
    <div className={cn('flex flex-col gap-2', className)}>
      {search && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            type="search"
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="h-8 pl-8 text-[0.8125rem]"
            autoComplete="off"
          />
        </div>
      )}
      <div className="-mx-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1">
        {facets
          .filter((facet) => facet.options.length > 0)
          .map((facet) => (
            <FacetSelect
              key={facet.key}
              label={facet.label}
              allLabel={facet.allLabel}
              value={facet.value}
              options={facet.options}
              onChange={facet.onChange}
            />
          ))}
        {children}
      </div>
    </div>
  );
}

/** Le tri, au même poids visuel qu'une facette : c'est un réglage, pas une action. */
export function SortSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <FacetSelect
      label={label}
      allLabel={options[0]?.label ?? label}
      // Le tri a toujours une valeur : il ne doit pas s'afficher comme un filtre actif
      value={undefined}
      shown={value}
      options={options.map((option) => ({ value: option.value, label: option.label }))}
      onChange={(next) => onChange(next ?? options[0]?.value ?? '')}
    />
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
      className="flex h-9 cursor-pointer items-center gap-2 rounded-xs px-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink has-checked:bg-label has-checked:text-label-ink"
    >
      <input
        type="checkbox"
        className="size-3 accent-(--label)"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
