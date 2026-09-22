'use client';
import type { CardSummaryDto, DeckZone } from '@ygo/shared';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CardFilters } from '@/components/cards/card-filters';
import { CardGrid, CardTile } from '@/components/cards/card-tile';
import { Pagination, Skeleton } from '@/components/ui/feedback';
import { useCardSearch, type CardSearchParams } from '@/lib/api/cards';
import { useDeckCardSuggestions } from '@/lib/api/decks';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';

type Tab = 'search' | 'suggestions';

/**
 * Panneau de gauche : recherche (par défaut limitée aux cartes possédées) ou suggestions.
 * Clic = fiche de la carte (stats, effets, + / − dans le deck) · Ctrl/⌘+clic = ajout direct
 * au Main/Extra · Maj+clic = ajout direct au Side.
 */
export function CardPicker({
  deckId,
  onPick,
  onInspect,
}: {
  deckId: string;
  onPick: (card: CardSummaryDto, zone?: DeckZone) => void;
  onInspect: (cardId: number) => void;
}) {
  const t = useTranslations('deckBuilder.picker');
  const [tab, setTab] = useState<Tab>('search');
  const [params, setParams] = useState<CardSearchParams>({ owned: true, page: 1, pageSize: 36 });
  const search = useCardSearch(useDebounced(params), tab === 'search');
  const suggestions = useDeckCardSuggestions(deckId);

  const tile = (card: CardSummaryDto) => (
    <div
      key={card.id}
      title={t('tileTitle', { name: card.name })}
      onClickCapture={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) onPick(card);
        else if (e.shiftKey) onPick(card, 'SIDE');
        else onInspect(card.id);
      }}
    >
      <CardTile card={card} dimmed={!card.ownedQuantity} />
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-sm">
        {(['search', 'suggestions'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium',
              tab === id ? 'bg-bg-elevated shadow-sm' : 'text-fg-muted',
            )}
          >
            {id === 'suggestions' && <Sparkles className="size-3.5 text-accent" />}
            {id === 'search'
              ? t('search')
              : suggestions.data
                ? t('suggestionsCount', { count: suggestions.data.length })
                : t('suggestions')}
          </button>
        ))}
      </div>

      {tab === 'search' ? (
        <>
          <CardFilters value={params} onChange={setParams} compact />
          <div className="flex-1">
            {search.isLoading ? (
              <CardGrid>
                {Array.from({ length: 12 }, (_, i) => (
                  <Skeleton key={i} className="aspect-(--aspect-card)" />
                ))}
              </CardGrid>
            ) : search.data?.items.length ? (
              <>
                <CardGrid>{search.data.items.map(tile)}</CardGrid>
                <Pagination
                  page={search.data.page}
                  totalPages={search.data.totalPages}
                  onChange={(page) => setParams((p) => ({ ...p, page }))}
                />
              </>
            ) : (
              <p className="py-10 text-center text-sm text-fg-subtle">
                {params.owned ? t('noOwnedResults') : t('noResults')}
              </p>
            )}
          </div>
        </>
      ) : suggestions.isLoading ? (
        <Skeleton className="h-40" />
      ) : suggestions.data?.length ? (
        <div className="space-y-2">
          <p className="text-xs text-fg-subtle">{t('suggestionsHint')}</p>
          <CardGrid>{suggestions.data.map((s) => tile(s.card))}</CardGrid>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-fg-subtle">{t('suggestionsEmpty')}</p>
      )}
    </div>
  );
}
