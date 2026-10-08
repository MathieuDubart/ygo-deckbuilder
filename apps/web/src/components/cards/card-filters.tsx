'use client';
import { CARD_CATEGORIES } from '@ygo/shared';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useArchetypes, type CardSearchParams } from '@/lib/api/cards';
import { FacetSelect } from '@/components/ui/facet-select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SORTS = ['relevance', 'name', 'newest', 'atk', 'def', 'level'] as const;

export function CardFilters({
  value,
  onChange,
  compact,
}: {
  value: CardSearchParams;
  onChange: (next: CardSearchParams) => void;
  compact?: boolean;
}) {
  const t = useTranslations('catalog.filters');
  const tc = useTranslations('common.categories');
  const { data: archetypes } = useArchetypes();
  const set = (patch: CardSearchParams) => onChange({ ...value, ...patch, page: 1 });

  return (
    <div className={cn('flex flex-col gap-3', !compact && 'md:flex-row md:items-center')}>
      <div className="relative flex-1 md:max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
        <Input
          type="search"
          placeholder={compact ? t('searchPlaceholderCompact') : t('searchPlaceholder')}
          value={value.q ?? ''}
          onChange={(e) => set({ q: e.target.value || undefined })}
          className="h-8 pl-8 text-[0.8125rem]"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-0.5">
          {CARD_CATEGORIES.slice(0, 3).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ category: value.category === c ? undefined : c })}
              className={cn(
                'h-8 rounded-xs px-2.5 text-xs font-medium transition-colors',
                value.category === c ? 'bg-label text-label-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {tc(c)}
            </button>
          ))}
        </div>

        <FacetSelect
          label={t('archetype')}
          allLabel={t('allArchetypes')}
          value={value.archetype}
          options={(archetypes ?? []).map((a) => ({ value: a, label: a }))}
          onChange={(archetype) => set({ archetype })}
        />

        {!compact && (
          <FacetSelect
            label={t('sortLabel')}
            allLabel={t('sortOption', { label: t('sort.name') })}
            value={undefined}
            shown={value.sort ?? (value.q ? 'relevance' : 'name')}
            options={SORTS.filter((v) => v !== 'relevance' || value.q).map((v) => ({
              value: v,
              label: t('sortOption', { label: t(`sort.${v}`) }),
            }))}
            onChange={(sort) => set({ sort: (sort ?? 'name') as CardSearchParams['sort'] })}
          />
        )}

        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-xs px-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink has-checked:bg-label has-checked:text-label-ink">
          <input
            type="checkbox"
            className="size-3 accent-(--label)"
            checked={!!value.owned}
            onChange={(e) => set({ owned: e.target.checked || undefined })}
          />
          {t('owned')}
        </label>
      </div>
    </div>
  );
}
