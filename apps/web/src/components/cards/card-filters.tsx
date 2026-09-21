'use client';
import { CARD_CATEGORIES } from '@ygo/shared';
import { Search } from 'lucide-react';
import { useArchetypes, type CardSearchParams } from '@/lib/api/cards';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  MONSTER: 'Monstres',
  SPELL: 'Magies',
  TRAP: 'Pièges',
  SKILL: 'Compétences',
  TOKEN: 'Jetons',
};

const SORTS = [
  ['relevance', 'Pertinence'],
  ['name', 'Nom'],
  ['newest', 'Plus récentes'],
  ['atk', 'ATK'],
  ['def', 'DEF'],
  ['level', 'Niveau'],
] as const;

export function CardFilters({
  value,
  onChange,
  compact,
}: {
  value: CardSearchParams;
  onChange: (next: CardSearchParams) => void;
  compact?: boolean;
}) {
  const { data: archetypes } = useArchetypes();
  const set = (patch: CardSearchParams) => onChange({ ...value, ...patch, page: 1 });

  return (
    <div className={cn('flex flex-col gap-3', !compact && 'md:flex-row md:items-center')}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          placeholder={
            compact ? 'Nom, archétype…' : 'Nom FR ou EN, archétype, ou code imprimé (SDBE-FR001)…'
          }
          value={value.q ?? ''}
          onChange={(e) => set({ q: e.target.value || undefined })}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-border bg-bg-sunken p-0.5">
          {CARD_CATEGORIES.slice(0, 3).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ category: value.category === c ? undefined : c })}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                value.category === c
                  ? 'bg-bg-elevated text-fg shadow-sm'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <Select
          aria-label="Archétype"
          value={value.archetype ?? ''}
          onChange={(e) => set({ archetype: e.target.value || undefined })}
          className="w-auto min-w-36"
        >
          <option value="">Tous archétypes</option>
          {archetypes?.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>

        {!compact && (
          <Select
            aria-label="Tri"
            value={value.sort ?? (value.q ? 'relevance' : 'name')}
            onChange={(e) => set({ sort: e.target.value as CardSearchParams['sort'] })}
            className="w-auto"
          >
            {SORTS.filter(([v]) => v !== 'relevance' || value.q).map(([v, l]) => (
              <option key={v} value={v}>
                Tri : {l}
              </option>
            ))}
          </Select>
        )}

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg-sunken px-3 text-xs font-medium text-fg-muted has-checked:border-success/50 has-checked:text-success">
          <input
            type="checkbox"
            className="accent-(--success)"
            checked={!!value.owned}
            onChange={(e) => set({ owned: e.target.checked || undefined })}
          />
          Possédées
        </label>
      </div>
    </div>
  );
}
