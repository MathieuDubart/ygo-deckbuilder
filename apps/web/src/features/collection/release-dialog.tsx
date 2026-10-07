'use client';
import type { ReleaseCardDto } from '@ygo/shared';
import { CircleSlash, PackageSearch } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { ProductCover } from '@/components/products/product-cover';
import { TagPicker } from '@/components/tags/tag-picker';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, Meter, Skeleton, Stat } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { useRelease } from '@/lib/api/releases';
import { useTagSet } from '@/lib/api/tags';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FilterToggle } from './facet-bar';

type Shown = 'all' | 'owned' | 'missing';

/**
 * Une extension carte par carte : ce qu'on peut y tirer, ce qu'on a déjà, et ce qui manque.
 * La bascule « toutes éditions » décide si une carte possédée ailleurs coche la case ici,
 * et elle remonte à l'onglet pour que les deux vues restent d'accord.
 */
export function ReleaseDialog({
  setId,
  anyEdition,
  onAnyEditionChange,
  onClose,
}: {
  setId: string | null;
  anyEdition: boolean;
  onAnyEditionChange: (value: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations('releases');
  const { data, isLoading } = useRelease(setId);
  const { date, number, percent, price } = useFormat();
  const tagSet = useTagSet();
  const [shown, setShown] = useState<Shown>('all');
  const [rarity, setRarity] = useState<string | undefined>();
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const has = (card: ReleaseCardDto) => card.owned > 0 || (anyEdition && card.ownedElsewhere > 0);
  const cards = useMemo(() => {
    if (!data) return [];
    return data.cards.filter(
      (card) =>
        (!rarity || card.rarity === rarity) &&
        (shown === 'all' || (shown === 'owned' ? has(card) : !has(card))),
    );
    // `has` dépend de anyEdition, qui est bien dans les dépendances
  }, [data, rarity, shown, anyEdition]);

  const owned = anyEdition ? data?.progress.ownedCards : data?.progress.ownedPrints;
  const total = anyEdition ? data?.progress.cards : data?.progress.prints;

  return (
    <>
      <Dialog
        open={setId !== null}
        onClose={onClose}
        title={data?.set.name ?? t('title')}
        variant="sheet"
      >
        {isLoading || !data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto p-5">
            <header className="flex gap-4">
              <ProductCover set={data.set} sizes="120px" className="aspect-[3/4] w-24 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.set.code && <Badge>{data.set.code}</Badge>}
                  <Badge tone={data.status === 'UPCOMING' ? 'accent' : 'neutral'}>
                    {t(`status.${data.status}`)}
                  </Badge>
                  {data.ownedProduct && <Badge tone="success">{t('sealed')}</Badge>}
                </div>
                <p className="font-mono text-xs text-fg-subtle">
                  {data.set.tcgDate ? date(data.set.tcgDate) : t('noDate')}
                  {data.status === 'UPCOMING' &&
                    data.daysUntil !== null &&
                    ` · ${data.daysUntil === 0 ? t('today') : t('inDays', { count: data.daysUntil })}`}
                </p>
                <TagPicker
                  attached={data.tagIds}
                  onToggle={(tagId, on) => tagSet.mutate({ tagId, setId: data.set.id, on })}
                />
              </div>
            </header>

            {total ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {t(anyEdition ? 'progress.labelCards' : 'progress.labelPrints')}
                    </span>
                    <span className="font-mono tabular-nums">
                      {number(owned ?? 0)} / {number(total)} ·{' '}
                      {percent(total ? (owned ?? 0) / total : 0)}
                    </span>
                  </div>
                  <Meter value={owned ?? 0} total={total} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Stat label={t('stats.copies')} value={number(data.progress.copies)} />
                  <Stat label={t('stats.ownedValue')} value={price(data.ownedValue)} />
                  <Stat label={t('stats.missingValue')} value={price(data.missingValue)} />
                </div>

                {/* Avancement par rareté : c'est là qu'on voit ce qui coince */}
                {data.rarities.length > 1 && (
                  <ul className="space-y-2">
                    {data.rarities.map((row) => (
                      <li key={row.rarity} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate text-fg-muted">{row.rarity}</span>
                          <span className="font-mono text-fg-subtle tabular-nums">
                            {row.ownedPrints}/{row.prints}
                          </span>
                        </div>
                        <Meter value={row.ownedPrints} total={row.prints} />
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-lg border border-border bg-bg-sunken p-0.5">
                    {(['all', 'owned', 'missing'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setShown(value)}
                        aria-pressed={shown === value}
                        className={cn(
                          'rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                          shown === value
                            ? 'bg-bg-elevated text-fg shadow-sm'
                            : 'text-fg-muted hover:text-fg',
                        )}
                      >
                        {t(`shown.${value}`)}
                      </button>
                    ))}
                  </div>
                  {data.rarities.length > 1 && (
                    <Select
                      aria-label={t('filters.rarity')}
                      value={rarity ?? ''}
                      onChange={(e) => setRarity(e.target.value || undefined)}
                      className="h-9 w-auto max-w-44"
                    >
                      <option value="">{t('filters.allRarities')}</option>
                      {data.rarities.map((row) => (
                        <option key={row.rarity} value={row.rarity}>
                          {row.rarity} ({row.prints})
                        </option>
                      ))}
                    </Select>
                  )}
                  <FilterToggle
                    checked={anyEdition}
                    onChange={onAnyEditionChange}
                    title={t('anyEditionHint')}
                  >
                    {t('anyEdition')}
                  </FilterToggle>
                </div>

                {!cards.length ? (
                  <EmptyState icon={CircleSlash} title={t('noCardsShown')} />
                ) : (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3">
                    {cards.map((card) => (
                      <PrintTile
                        key={card.printId}
                        card={card}
                        owned={has(card)}
                        onOpen={() => setSelectedCard(card.card.id)}
                      />
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <EmptyState
                icon={PackageSearch}
                title={t('unrevealed')}
                description={t('unrevealedHint')}
              />
            )}
          </div>
        )}
      </Dialog>

      <CardDetailDialog cardId={selectedCard} onClose={() => setSelectedCard(null)} />
    </>
  );
}

function PrintTile({
  card,
  owned,
  onOpen,
}: {
  card: ReleaseCardDto;
  owned: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('releases');
  return (
    <li>
      <button type="button" onClick={onOpen} className="group w-full space-y-1 text-left">
        <div className="relative">
          <CardImage
            card={card.card}
            sizes="88px"
            className={cn('transition', !owned && 'opacity-40 saturate-0 group-hover:opacity-70')}
          />
          {card.owned > 0 && (
            <span className="absolute top-1 right-1">
              <Badge tone="success">×{card.owned}</Badge>
            </span>
          )}
          {/* Possédée, mais pas dans cette extension : utile à savoir avant de racheter */}
          {card.owned === 0 && card.ownedElsewhere > 0 && (
            <span className="absolute top-1 right-1" title={t('elsewhereHint')}>
              <Badge tone="warning" className="px-1">
                {t('elsewhere')}
              </Badge>
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[10px] text-fg-subtle">{card.printCode}</p>
        <p className="line-clamp-2 text-[11px] leading-tight text-fg-muted">{card.rarity}</p>
      </button>
    </li>
  );
}
