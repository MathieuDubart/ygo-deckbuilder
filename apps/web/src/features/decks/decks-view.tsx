'use client';
import { DECK_FORMATS, DECK_SORTS } from '@ygo/shared';
import { Copy, Layers, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { TagChip } from '@/components/tags/tag-chip';
import { TagFilter } from '@/components/tags/tag-filter';
import { TagPicker } from '@/components/tags/tag-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FacetBar, SortSelect } from '@/components/ui/facet-bar';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/feedback';
import { useDecks, useDeleteDeck, useDuplicateDeck, type DeckParams } from '@/lib/api/decks';
import { useTagDeck, useTags } from '@/lib/api/tags';
import { useFormat } from '@/lib/format';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { NewDeckDialog } from './new-deck-dialog';

export function DecksView() {
  const t = useTranslations('decks');
  const { date } = useFormat();
  const [q, setQ] = useState('');
  const [params, setParams] = useState<DeckParams>({});
  const { data: decks, isLoading } = useDecks({ ...params, q: useDebounced(q) || undefined });
  const { data: tags } = useTags();
  const tagDeck = useTagDeck();
  const remove = useDeleteDeck();
  const duplicate = useDuplicateDeck();
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<DeckParams>) => setParams((p) => ({ ...p, ...patch }));
  // Un filtre actif change le sens d'une liste vide : « rien ne correspond », pas « crée
  // ton premier deck ». Les deux méritent un message différent.
  const filtering = !!(q || params.tagIds?.length || params.format);

  return (
    <>
      <PageHeader
        title={t('view.title')}
        description={t('view.description')}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> {t('view.newDeck')}
          </Button>
        }
      />

      <FacetBar
        className="mb-3"
        search={{ value: q, placeholder: t('view.filterPlaceholder'), onChange: setQ }}
        facets={[
          {
            key: 'format',
            label: t('view.format'),
            allLabel: t('view.allFormats'),
            value: params.format,
            options: DECK_FORMATS.map((value) => ({ value, label: t(`formats.${value}`) })),
            onChange: (value) => set({ format: value as DeckParams['format'] }),
          },
        ]}
      >
        <SortSelect
          label={t('view.sort')}
          value={params.sort ?? 'updated'}
          onChange={(value) => set({ sort: value as DeckParams['sort'] })}
          options={DECK_SORTS.map((value) => ({
            value,
            label: t('view.sortOption', { label: t(`view.sorts.${value}`) }),
          }))}
        />
      </FacetBar>

      <TagFilter
        value={params.tagIds ?? []}
        onChange={(tagIds) => set({ tagIds: tagIds.length ? tagIds : undefined })}
        counts={(id) => tags?.find((tag) => tag.id === id)?.deckCount}
      />

      <div className="mt-4" />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !decks?.length ? (
        filtering ? (
          <EmptyState
            icon={Layers}
            title={t('view.noResults.title')}
            description={t('view.noResults.description')}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  setQ('');
                  setParams({});
                }}
              >
                {t('view.noResults.clear')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Layers}
            title={t('view.empty.title')}
            description={t('view.empty.description')}
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> {t('view.newDeck')}
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <li
              key={d.id}
              // Pas d'`overflow-hidden` : le panneau d'étiquettes s'ouvre hors de la carte
              // et serait tronqué. La vignette a son propre clip.
              className="group relative rounded-2xl border border-border bg-bg-elevated transition hover:border-border-strong"
            >
              <Link href={`/decks/${d.id}`} className="flex gap-4 p-4">
                <div className="relative aspect-(--aspect-card) w-16 shrink-0 overflow-hidden rounded bg-bg-sunken">
                  {d.coverImageUrl && (
                    <Image
                      src={d.coverImageUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="truncate font-semibold">{d.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{t(`formats.${d.format}`)}</Badge>
                    <Badge tone={d.mainCount >= 40 && d.mainCount <= 60 ? 'success' : 'warning'}>
                      {t('view.counts.main', { count: d.mainCount })}
                    </Badge>
                    <Badge>{t('view.counts.extra', { count: d.extraCount })}</Badge>
                    {d.sideCount > 0 && (
                      <Badge>{t('view.counts.side', { count: d.sideCount })}</Badge>
                    )}
                  </div>
                  {d.tagIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.tagIds.map((id) => {
                        const tag = tags?.find((candidate) => candidate.id === id);
                        return tag ? <TagChip key={id} tag={tag} /> : null;
                      })}
                    </div>
                  )}
                  <p className="text-xs text-fg-subtle">
                    {t('view.updatedOn', { date: date(d.updatedAt) })}
                  </p>
                </div>
              </Link>
              {/* Hors du lien : cliquer sur une étiquette ne doit pas ouvrir le deck */}
              <div className="px-4 pb-3">
                <TagPicker
                  attached={d.tagIds}
                  onToggle={(tagId, on) => tagDeck.mutate({ tagId, deckId: d.id, on })}
                />
              </div>
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('view.duplicate')}
                  onClick={() =>
                    duplicate.mutate(d.id, { onSuccess: () => toast.success(t('view.duplicated')) })
                  }
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('view.delete')}
                  onClick={() => {
                    if (confirm(t('view.confirmDelete', { name: d.name }))) remove.mutate(d.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewDeckDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
