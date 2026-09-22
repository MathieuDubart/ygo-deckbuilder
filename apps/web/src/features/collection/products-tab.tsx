'use client';
import type { OwnedProductDto } from '@ygo/shared';
import { Layers, PackageOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProductCover } from '@/components/products/product-cover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { useOwnedProducts } from '@/lib/api/collection';
import { cn } from '@/lib/utils';
import { ProductDialog } from './product-dialog';

/** Les produits ajoutés à la collection, pour retrouver et reconstituer leur contenu. */
export function ProductsTab({ onImport }: { onImport: () => void }) {
  const t = useTranslations('products.tab');
  const { data, isLoading } = useOwnedProducts();
  const [openId, setOpenId] = useState<string | null>(null);

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
      <EmptyState
        icon={PackageOpen}
        title={t('empty.title')}
        description={t('empty.description')}
        action={
          <Button variant="secondary" onClick={onImport}>
            <PackageOpen className="size-4" /> {t('addProduct')}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
        {data.map((p) => (
          <li key={p.id}>
            <ProductTile product={p} onOpen={() => setOpenId(p.id)} />
          </li>
        ))}
      </ul>
      <ProductDialog productId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function ProductTile({ product: p, onOpen }: { product: OwnedProductDto; onOpen: () => void }) {
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
        <div
          className="h-1.5 overflow-hidden rounded-full bg-bg-sunken"
          title={complete ? t('tab.complete') : t('tab.missing', { count: p.missingCopies })}
        >
          <div
            className={cn('h-full rounded-full', complete ? 'bg-success' : 'bg-warning')}
            style={{ width: `${Math.round(p.completeness * 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
}
