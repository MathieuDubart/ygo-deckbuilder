'use client';
import { Check, Heart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton, Stat } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import {
  useMarkAcquired,
  useRemoveWishlistItem,
  useUpdateWishlistItem,
  useWishlist,
  type WishlistItemDto,
} from '@/lib/api/wishlist';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export function WishlistView() {
  const t = useTranslations('wishlist.view');
  const { price } = useFormat();
  const { data, isLoading } = useWishlist();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {data && data.items.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <Stat label={t('stats.cards')} value={data.items.reduce((s, i) => s + i.quantity, 0)} />
          <Stat label={t('stats.estimatedCost')} value={price(data.totalEstimated)} />
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data?.items.length ? (
        <EmptyState icon={Heart} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-elevated">
          {data.items.map((item) => (
            <WishRow key={item.id} item={item} onOpen={() => setSelected(item.card.id)} />
          ))}
        </ul>
      )}
      <CardDetailDialog cardId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function WishRow({ item, onOpen }: { item: WishlistItemDto; onOpen: () => void }) {
  const t = useTranslations('wishlist');
  const { price } = useFormat();
  const update = useUpdateWishlistItem();
  const remove = useRemoveWishlistItem();
  const acquired = useMarkAcquired();
  const overBudget =
    item.maxPrice !== null && item.unitPrice !== null && item.unitPrice > item.maxPrice;

  return (
    <li className="flex flex-wrap items-center gap-4 px-3 py-2.5 sm:flex-nowrap">
      <button onClick={onOpen} className="w-11 shrink-0">
        <CardImage card={item.card} sizes="44px" />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block truncate text-left font-medium hover:text-accent">
          {item.quantity > 1 && <span className="text-fg-muted">{item.quantity}× </span>}
          {item.card.name}
        </button>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.print && (
            <Badge>
              {item.print.printCode} · {item.print.rarity}
            </Badge>
          )}
          {item.deck && (
            <Link href={`/decks/${item.deck.id}`}>
              <Badge tone="accent">↳ {item.deck.name}</Badge>
            </Link>
          )}
          {item.maxPrice !== null && (
            <Badge tone={overBudget ? 'danger' : 'success'}>
              {t('row.budget', { price: price(item.maxPrice) })}
            </Badge>
          )}
        </div>
      </div>
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          overBudget ? 'text-danger' : 'text-fg-muted',
        )}
      >
        {price(item.unitPrice)}
      </span>
      <Select
        aria-label={t('row.priority')}
        value={item.priority}
        onChange={(e) =>
          update.mutate({ id: item.id, priority: e.target.value as WishlistItemDto['priority'] })
        }
        className="h-8 w-28 text-xs"
      >
        {PRIORITIES.map((v) => (
          <option key={v} value={v}>
            {t(`priorities.${v}`)}
          </option>
        ))}
      </Select>
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          loading={acquired.isPending}
          onClick={() =>
            acquired.mutate(item.id, {
              onSuccess: () => toast.success(t('row.acquiredToast')),
            })
          }
        >
          <Check className="size-4" /> {t('row.acquired')}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('row.remove')}
          onClick={() => remove.mutate(item.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
