'use client';
import { PRODUCT_KINDS, type OwnedProductDto, type TagDto } from '@ygo/shared';
import { Layers, PackageOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProductCover } from '@/components/products/product-cover';
import { TagFilter } from '@/components/tags/tag-filter';
import { TagList } from '@/components/tags/tag-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Meter, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { useOwnedProducts, type OwnedProductsParams } from '@/lib/api/collection';
import { useTags } from '@/lib/api/tags';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';
import { FacetBar, FilterToggle, SortSelect } from '@/components/ui/facet-bar';
import { ProductDialog } from './product-dialog';

const SORTS = ['added', 'name', 'date', 'completeness'] as const;

/** Les produits ajoutés à la collection, pour retrouver et reconstituer leur contenu. */
export function ProductsTab({ onImport }: { onImport: () => void }) {
  const t = useTranslations('products.tab');
  const tf = useTranslations('products.filters');
  const tk = useTranslations('products.kinds');
  const [params, setParams] = useState<OwnedProductsParams>({});
  const [q, setQ] = useState('');
  const { data, isLoading } = useOwnedProducts({ ...params, q: useDebounced(q) || undefined });
  const { data: tags } = useTags();
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (patch: OwnedProductsParams) => setParams((p) => ({ ...p, ...patch }));
  const filtering = !!(q || params.kind || params.complete || params.tagIds?.length);

  const filters = (
    <>
      <FacetBar
        className="mb-3"
        search={{ value: q, placeholder: tf('searchPlaceholder'), onChange: setQ }}
        facets={[
          {
            key: 'kind',
            label: tf('kind'),
            allLabel: tf('allKinds'),
            value: params.kind,
            options: PRODUCT_KINDS.map((value) => ({ value, label: tk(value) })),
            onChange: (value) => set({ kind: value as OwnedProductsParams['kind'] }),
          },
        ]}
      >
        <SortSelect
          label={tf('sort')}
          value={params.sort ?? 'added'}
          onChange={(value) => set({ sort: value as OwnedProductsParams['sort'] })}
          options={SORTS.map((value) => ({
            value,
            label: tf('sortOption', { label: tf(`sorts.${value}`) }),
          }))}
        />
        <FilterToggle
          checked={!!params.complete}
          onChange={(checked) => set({ complete: checked || undefined })}
        >
          {tf('complete')}
        </FilterToggle>
      </FacetBar>
      <TagFilter
        value={params.tagIds ?? []}
        onChange={(tagIds) => set({ tagIds: tagIds.length ? tagIds : undefined })}
        counts={(id) => tags?.find((tag) => tag.id === id)?.setCount}
      />
    </>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <>
        {filtering && filters}
        <EmptyState
          icon={PackageOpen}
          title={filtering ? t('empty.noMatch') : t('empty.title')}
          description={filtering ? undefined : t('empty.description')}
          action={
            !filtering && (
              <Button variant="secondary" onClick={onImport}>
                <PackageOpen className="size-4" /> {t('addProduct')}
              </Button>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      {filters}
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
        {data.map((p) => (
          <li key={p.id}>
            <ProductTile product={p} tags={tags} onOpen={() => setOpenId(p.id)} />
          </li>
        ))}
      </ul>
      <ProductDialog productId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function ProductTile({
  product: p,
  tags,
  onOpen,
}: {
  product: OwnedProductDto;
  tags?: TagDto[];
  onOpen: () => void;
}) {
  const t = useTranslations('products');
  const complete = p.completeness >= 1;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-2 rounded-2xl border border-border bg-bg-elevated p-2 text-left transition hover:border-border-strong"
    >
      <div className="relative">
        <ProductCover
          set={p.set}
          sizes="(max-width: 640px) 45vw, 200px"
          className="aspect-[3/4] w-full transition group-hover:-translate-y-0.5"
        />
        <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
          {p.copies > 1 && <Badge tone="accent">×{p.copies}</Badge>}
          <Badge>{p.language}</Badge>
          {p.isDeck && (
            <Badge tone="success">
              <Layers className="size-3" /> {t('tab.deck')}
            </Badge>
          )}
        </div>
      </div>
      <div className="min-w-0 space-y-1 px-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{p.set.name}</p>
        <p className="font-mono text-[11px] text-fg-subtle">
          {t(`kinds.${p.set.kind}`)} · {t('tab.cardCount', { count: p.totalCards })}
        </p>
        <Meter
          value={Math.round(p.completeness * 100)}
          total={100}
          title={complete ? t('tab.complete') : t('tab.missing', { count: p.missingCopies })}
        />
        <TagList tagIds={p.tagIds} tags={tags} />
      </div>
    </button>
  );
}
