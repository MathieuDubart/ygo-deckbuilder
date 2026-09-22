'use client';
import type { CardCondition } from '@ygo/shared';
import { Boxes, Library, Minus, PackageOpen, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Pagination, Skeleton, Stat } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  useCollection,
  useCollectionStats,
  useOwnedProducts,
  useRemoveCollectionItem,
  useUpdateCollectionItem,
  type CollectionItemDto,
} from '@/lib/api/collection';
import { useFormat } from '@/lib/format';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';
import { ImportSetDialog } from './import-set-dialog';
import { ProductDialog } from './product-dialog';
import { ProductsTab } from './products-tab';

type Tab = 'cards' | 'products';

export function CollectionView() {
  const t = useTranslations('collection.view');
  const { price, number } = useFormat();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCollection({
    q: useDebounced(q) || undefined,
    page,
    pageSize: 50,
  });
  const { data: stats } = useCollectionStats();
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('cards');
  const [justImported, setJustImported] = useState<string | null>(null);
  const products = useOwnedProducts();

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

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label={t('stats.copies')} value={stats ? number(stats.totalCopies) : '—'} />
        <Stat label={t('stats.distinctCards')} value={stats ? number(stats.distinctCards) : '—'} />
        <Stat label={t('stats.estimatedValue')} value={stats ? price(stats.estimatedValue) : '—'} />
      </div>

      <div
        role="tablist"
        aria-label={t('tabs.label')}
        className="mb-4 inline-grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-sm"
      >
        {(
          [
            ['cards', t('tabs.cards'), Library, stats?.distinctCards],
            ['products', t('tabs.products'), Boxes, products.data?.length],
          ] as const
        ).map(([value, label, Icon, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 font-medium transition',
              tab === value ? 'bg-bg-elevated shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon className="size-4" /> {label}
            {count !== undefined && (
              <span className="font-mono text-xs text-fg-subtle tabular-nums">{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <ProductsTab onImport={() => setImportOpen(true)} />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              placeholder={t('filterPlaceholder')}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

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
                  <Button variant="secondary" onClick={() => setImportOpen(true)}>
                    <PackageOpen className="size-4" /> {t('addProduct')}
                  </Button>
                )
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-elevated">
                {data.items.map((item) => (
                  <CollectionRow
                    key={item.id}
                    item={item}
                    onOpen={() => setSelected(item.card.id)}
                  />
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </>
          )}
        </>
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
  const busy = update.isPending || remove.isPending;
  const setQty = (quantity: number) => update.mutate({ id: item.id, quantity });

  return (
    <li className="flex items-center gap-4 px-3 py-2.5">
      <button onClick={onOpen} className="w-11 shrink-0">
        <CardImage card={item.card} sizes="44px" />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block truncate text-left font-medium hover:text-accent">
          {item.card.name}
        </button>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.print ? (
            <Badge>
              {item.print.printCode} · {item.print.rarity}
            </Badge>
          ) : (
            <Badge>{t('row.unknownPrint')}</Badge>
          )}
          <Badge>{item.language}</Badge>
          <Badge>{t(`conditions.${item.condition as CardCondition}`)}</Badge>
          {item.firstEdition && <Badge tone="accent">1st</Badge>}
        </div>
      </div>
      <span className="hidden font-mono text-sm text-fg-muted tabular-nums sm:block">
        {price(item.print?.price ?? item.card.priceCardmarket)}
      </span>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-sunken p-0.5">
        <button
          className="rounded-md p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-40"
          disabled={busy}
          onClick={() => setQty(item.quantity - 1)}
          aria-label={t('row.removeCopy')}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center font-mono text-sm tabular-nums">{item.quantity}</span>
        <button
          className="rounded-md p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-40"
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
