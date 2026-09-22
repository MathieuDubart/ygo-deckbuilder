'use client';
import type { OfficialDeckSuggestionDto } from '@ygo/shared';
import { Boxes, PackageCheck, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProductCover } from '@/components/products/product-cover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import {
  useOfficialDecks,
  type GenerationTarget,
  type OfficialDeckKind,
} from '@/lib/api/suggestions';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CoverageRing } from './coverage-ring';

const FILTERS: (OfficialDeckKind | undefined)[] = [undefined, 'STRUCTURE', 'STARTER', 'BOX'];
const PAGE = 9;

/**
 * Decks préconstruits officiels (structure decks, starters, decks de coffrets comme
 * Legendary Decks ou le 2-Player Starter Set), classés par part déjà possédée.
 */
export function OfficialDecks({ onOpen }: { onOpen: (target: GenerationTarget) => void }) {
  const t = useTranslations('suggestions.official');
  const [kind, setKind] = useState<OfficialDeckKind | undefined>();
  const [shown, setShown] = useState(PAGE);
  const { data, isLoading, isFetching } = useOfficialDecks(kind);

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        role="tablist"
        aria-label={t('filterLabel')}
      >
        {FILTERS.map((k) => (
          <button
            key={k ?? 'ALL'}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setShown(PAGE);
            }}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition',
              kind === k
                ? 'border-accent/50 bg-accent/15 text-fg'
                : 'border-border text-fg-muted hover:text-fg',
            )}
          >
            {t(`filters.${k ?? 'ALL'}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState icon={Boxes} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <>
          <ul
            className={cn(
              'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition',
              isFetching && 'opacity-60',
            )}
          >
            {data.slice(0, shown).map((d) => (
              <OfficialDeckCard
                key={d.productDeckId}
                deck={d}
                onBuild={() =>
                  onOpen({ kind: 'official', productDeckId: d.productDeckId, name: displayName(d) })
                }
              />
            ))}
          </ul>
          {data.length > shown && (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                {t('showMore', { count: data.length - shown })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const displayName = (d: OfficialDeckSuggestionDto) =>
  d.deckName ? `${d.product.name} — ${d.deckName}` : d.product.name;

function OfficialDeckCard({
  deck: d,
  onBuild,
}: {
  deck: OfficialDeckSuggestionDto;
  onBuild: () => void;
}) {
  const t = useTranslations('suggestions.official');
  const tm = useTranslations('suggestions.meta.card');
  const { price } = useFormat();
  const complete = d.ownedCopies >= d.requiredCopies;
  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-bg-elevated p-3 transition hover:border-border-strong">
      <ProductCover set={d.product} sizes="96px" className="aspect-[3/4] w-24 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm leading-snug font-semibold" title={d.product.name}>
              {d.deckName ?? d.product.name}
            </p>
            {d.deckName && (
              <p className="truncate text-xs text-fg-subtle" title={d.product.name}>
                {d.product.name}
              </p>
            )}
            <p className="font-mono text-[11px] text-fg-subtle">
              {d.product.code ?? '—'}
              {d.product.tcgDate && ` · ${d.product.tcgDate.slice(0, 4)}`}
            </p>
          </div>
          <CoverageRing value={d.coverage} />
        </div>
        <div className="flex flex-wrap gap-1">
          {d.productOwned && (
            <Badge tone="success">
              <PackageCheck className="size-3" /> {t('owned')}
            </Badge>
          )}
          {d.archetype && <Badge>{d.archetype}</Badge>}
        </div>
        <p className="text-xs text-fg-muted">
          {complete ? (
            <span className="text-success">{tm('playable')}</span>
          ) : (
            tm.rich('missing', {
              owned: d.ownedCopies,
              required: d.requiredCopies,
              cost: price(d.estimatedCostToComplete),
              strong: (c) => <strong className="text-fg">{c}</strong>,
            })
          )}
        </p>
        <Button
          size="sm"
          className="mt-auto self-start"
          variant={d.coverage >= 0.5 ? 'primary' : 'secondary'}
          onClick={onBuild}
        >
          <Wand2 className="size-4" /> {tm('build')}
        </Button>
      </div>
    </li>
  );
}
