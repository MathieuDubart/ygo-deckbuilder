'use client';
import { Copy, Layers, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/feedback';
import { useDecks, useDeleteDeck, useDuplicateDeck } from '@/lib/api/decks';
import { useFormat } from '@/lib/format';
import { NewDeckDialog } from './new-deck-dialog';

export function DecksView() {
  const t = useTranslations('decks');
  const { date } = useFormat();
  const { data: decks, isLoading } = useDecks();
  const remove = useDeleteDeck();
  const duplicate = useDuplicateDeck();
  const [open, setOpen] = useState(false);

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

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !decks?.length ? (
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
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <li
              key={d.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-bg-elevated transition hover:border-border-strong"
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
                  <p className="text-xs text-fg-subtle">
                    {t('view.updatedOn', { date: date(d.updatedAt) })}
                  </p>
                </div>
              </Link>
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
