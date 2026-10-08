'use client';
import { CARD_CATEGORIES, CARD_CONDITIONS, CARD_LANGUAGES, type CardCondition } from '@ygo/shared';
import { Boxes, Library, Minus, PackageOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { TagFilter } from '@/components/tags/tag-filter';
import { TagList, TagPicker } from '@/components/tags/tag-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  Figures,
  PageHeader,
  Pagination,
  Skeleton,
  Stat,
} from '@/components/ui/feedback';
import { DividerTabs } from '@/components/ui/tabs';
import { Select } from '@/components/ui/input';
import {
  useCollection,
  useCollectionFacets,
  useCollectionStats,
  useRemoveCollectionItem,
  useUpdateCollectionItem,
  type CollectionItemDto,
  type CollectionParams,
} from '@/lib/api/collection';
import { useTagCard, useTags } from '@/lib/api/tags';
import { useFormat } from '@/lib/format';
import { isPremiumRarity } from '@/lib/rarity';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';
import { FacetBar, FilterToggle, SortSelect } from './facet-bar';
import { ImportSetDialog } from './import-set-dialog';
import { ProductDialog } from './product-dialog';
import { ProductsTab } from './products-tab';
import { ReleasesTab } from './releases-tab';

type Tab = 'cards' | 'products' | 'releases';

const SORTS = ['name', 'quantity', 'value', 'rarity', 'newest'] as const;

export function CollectionView() {
  const t = useTranslations('collection.view');
  const { price, number } = useFormat();
  const { data: stats } = useCollectionStats();
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('cards');
  const [justImported, setJustImported] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <PackageOpen className="size-4" /> {t('addProduct')}
            </Button>
            <Link href="/cards">
              <Button>
                <Plus className="size-4" /> {t('addCards')}
              </Button>
            </Link>
          </>
        }
      />

      <Figures>
        <Stat label={t('stats.copies')} value={stats ? number(stats.totalCopies) : '—'} />
        <Stat label={t('stats.distinctCards')} value={stats ? number(stats.distinctCards) : '—'} />
        <Stat label={t('stats.estimatedValue')} value={stats ? price(stats.estimatedValue) : '—'} />
      </Figures>

      <DividerTabs
        label={t('tabs.label')}
        value={tab}
        onChange={setTab}
        className="mb-6"
        items={[
          { value: 'cards', label: t('tabs.cards'), icon: Library },
          { value: 'products', label: t('tabs.products'), icon: Boxes },
          { value: 'releases', label: t('tabs.releases'), icon: Sparkles },
        ]}
      />

      {tab === 'releases' ? (
        <ReleasesTab />
      ) : tab === 'products' ? (
        <ProductsTab onImport={() => setImportOpen(true)} />
      ) : (
        <CardsTab onImport={() => setImportOpen(true)} />
      )}

      <ImportSetDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(id) => {
          setTab('products');
          setJustImported(id);
        }}
      />
      <ProductDialog productId={justImported} onClose={() => setJustImported(null)} />
    </>
  );
}

/** Les cartes possédées, filtrables par facettes et par étiquettes. */
function CardsTab({ onImport }: { onImport: () => void }) {
  const t = useTranslations('collection.view');
  const tf = useTranslations('collection.filters');
  const tc = useTranslations('common.categories');
  const tcond = useTranslations('collection.conditions');
  const [params, setParams] = useState<CollectionParams>({ page: 1, pageSize: 50 });
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  const { data, isLoading, isFetching } = useCollection({
    ...params,
    q: useDebounced(q) || undefined,
  });
  const { data: facets } = useCollectionFacets();
  const { data: tags } = useTags();
  const set = (patch: CollectionParams) => setParams((p) => ({ ...p, ...patch, page: 1 }));

  return (
    <>
      <FacetBar
        className="mb-3"
        search={{ value: q, placeholder: t('filterPlaceholder'), onChange: setQ }}
        facets={[
          {
            key: 'category',
            label: tf('category'),
            allLabel: tf('allCategories'),
            value: params.category,
            options: CARD_CATEGORIES.map((value) => ({
              value,
              label: tc(value),
              count: facets?.categories.find((f) => f.value === value)?.count,
            })).filter((o) => o.count),
            onChange: (value) => set({ category: value as CollectionParams['category'] }),
          },
          {
            key: 'archetype',
            label: tf('archetype'),
            allLabel: tf('allArchetypes'),
            value: params.archetype,
            options: (facets?.archetypes ?? []).map(({ value, count }) => ({
              value,
              label: value,
              count,
            })),
            onChange: (value) => set({ archetype: value }),
          },
          {
            key: 'rarity',
            label: tf('rarity'),
            allLabel: tf('allRarities'),
            value: params.rarity,
            options: (facets?.rarities ?? []).map(({ value, count }) => ({
              value,
              label: value,
              count,
            })),
            onChange: (value) => set({ rarity: value }),
          },
          {
            key: 'language',
            label: tf('language'),
            allLabel: tf('allLanguages'),
            value: params.language,
            options: CARD_LANGUAGES.map((value) => ({
              value,
              label: value,
              count: facets?.languages.find((f) => f.value === value)?.count,
            })).filter((o) => o.count),
            onChange: (value) => set({ language: value as CollectionParams['language'] }),
          },
          {
            key: 'condition',
            label: tf('condition'),
            allLabel: tf('allConditions'),
            value: params.condition,
            options: CARD_CONDITIONS.map((value) => ({
              value,
              label: tcond(value),
              count: facets?.conditions.find((f) => f.value === value)?.count,
            })).filter((o) => o.count),
            onChange: (value) => set({ condition: value as CollectionParams['condition'] }),
          },
          {
            key: 'setId',
            label: tf('set'),
            allLabel: tf('allSets'),
            value: params.setId,
            // La valeur est l'identifiant de l'extension, son nom vient du libellé
            options: (facets?.sets ?? []).map(({ value, count, label }) => ({
              value,
              label: label ?? value,
              count,
            })),
            onChange: (value) => set({ setId: value }),
          },
        ]}
      >
        <SortSelect
          label={tf('sort')}
          value={params.sort ?? 'name'}
          onChange={(value) => set({ sort: value as CollectionParams['sort'] })}
          options={SORTS.map((value) => ({
            value,
            label: tf('sortOption', { label: tf(`sorts.${value}`) }),
          }))}
        />
        <FilterToggle
          checked={!!params.firstEdition}
          onChange={(checked) => set({ firstEdition: checked || undefined })}
        >
          {tf('firstEdition')}
        </FilterToggle>
      </FacetBar>

      <TagFilter
        value={params.tagIds ?? []}
        onChange={(tagIds) => set({ tagIds: tagIds.length ? tagIds : undefined })}
        counts={(id) => tags?.find((tag) => tag.id === id)?.cardCount}
      />

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            icon={Library}
            title={q ? t('empty.noMatch') : t('empty.title')}
            description={q ? undefined : t('empty.description')}
            action={
              !q && (
                <Button variant="secondary" onClick={onImport}>
                  <PackageOpen className="size-4" /> {t('addProduct')}
                </Button>
              )
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
            <ul className="divide-y divide-edge border-y border-edge">
              {data.items.map((item) => (
                <CollectionRow key={item.id} item={item} onOpen={() => setSelected(item.card.id)} />
              ))}
            </ul>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onChange={(page) => setParams((p) => ({ ...p, page }))}
            />
          </div>
        )}
      </div>

      <CardDetailDialog cardId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function CollectionRow({ item, onOpen }: { item: CollectionItemDto; onOpen: () => void }) {
  const t = useTranslations('collection');
  const tc = useTranslations('common.actions');
  const { price } = useFormat();
  const update = useUpdateCollectionItem();
  const remove = useRemoveCollectionItem();
  const tagCard = useTagCard();
  const { data: tags } = useTags();
  const busy = update.isPending || remove.isPending;
  const setQty = (quantity: number) => update.mutate({ id: item.id, quantity });
  const attached = item.card.tagIds ?? [];

  return (
    <li className="flex items-center gap-4 py-2.5 pr-1 pl-2">
      {/* La vignette est glissée dans une pochette : c'est le geste du classeur */}
      <button onClick={onOpen} className="pocket w-11 shrink-0 rounded-xs p-0.5">
        <CardImage card={item.card} sizes="44px" />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block truncate text-left font-medium hover:underline">
          {item.card.name}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.print ? (
            <span className="flex items-center gap-2">
              <span className="code text-[11px] text-ink-faint">{item.print.printCode}</span>
              <span
                className={cn(
                  'text-[11px]',
                  isPremiumRarity(item.print.rarity) ? 'text-gold' : 'text-ink-muted',
                )}
              >
                {item.print.rarity}
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-ink-faint">{t('row.unknownPrint')}</span>
          )}
          <span className="text-[11px] text-ink-faint">
            {item.language} · {t(`conditions.${item.condition as CardCondition}`)}
            {item.firstEdition && ' · 1st'}
          </span>
          {/* Chaque étiquette garde sa couleur : c'est à ça qu'on la reconnaît */}
          <TagList tagIds={attached} tags={tags} />
        </div>
      </div>
      <span className="code hidden text-sm text-ink-muted sm:block">
        {price(item.print?.price ?? item.card.priceCardmarket)}
      </span>
      <TagPicker
        attached={attached}
        label=""
        onToggle={(tagId, on) => tagCard.mutate({ tagId, cardId: item.card.id, on })}
      />
      <div className="pocket flex items-center gap-1 rounded-xs p-0.5">
        <button
          className="rounded-md p-1.5 text-fg-muted hover:bg-ink/5 hover:text-fg disabled:opacity-40"
          disabled={busy}
          onClick={() => setQty(item.quantity - 1)}
          aria-label={t('row.removeCopy')}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center font-mono text-sm tabular-nums">{item.quantity}</span>
        <button
          className="rounded-md p-1.5 text-fg-muted hover:bg-ink/5 hover:text-fg disabled:opacity-40"
          disabled={busy}
          onClick={() => setQty(item.quantity + 1)}
          aria-label={t('row.addCopy')}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        onClick={() => remove.mutate(item.id)}
        aria-label={tc('delete')}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
