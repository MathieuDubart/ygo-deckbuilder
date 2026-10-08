'use client';
import { banStatusForFormat, type CardSummaryDto, type DeckFormat, type DeckZone } from '@ygo/shared';
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
  format,
  onPick,
  onInspect,
  blockedReason,
}: {
  deckId: string;
  format: DeckFormat;
  onPick: (card: CardSummaryDto, zone?: DeckZone) => void;
  onInspect: (cardId: number) => void;
  /** Pourquoi cette carte ne peut pas rejoindre le deck, ou `null` si elle peut. */
  blockedReason: (card: CardSummaryDto) => string | null;
}) {
  const t = useTranslations('deckBuilder.picker');
  const [tab, setTab] = useState<Tab>('search');
  const [params, setParams] = useState<CardSearchParams>({ owned: true, page: 1, pageSize: 36 });
  const search = useCardSearch(useDebounced(params), tab === 'search');
  const suggestions = useDeckCardSuggestions(deckId);

  /**
   * Une carte bloquée garde sa fiche cliquable — on veut pouvoir lire pourquoi — mais les
   * raccourcis d'ajout ne répondent plus : rien ne part dans le deck, et rien n'échoue en
   * silence non plus, la vignette porte déjà la raison.
   */
  const tile = (card: CardSummaryDto) => {
    const blocked = blockedReason(card);
    return (
      <div
        key={card.id}
        title={
          blocked
            ? t('tileBlocked', { name: card.name, reason: blocked })
            : t('tileTitle', { name: card.name })
        }
        onClickCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (blocked || (!e.metaKey && !e.ctrlKey && !e.shiftKey)) return onInspect(card.id);
          if (e.shiftKey) onPick(card, 'SIDE');
          else onPick(card);
        }}
      >
        <CardTile
          card={card}
          dimmed={!card.ownedQuantity}
          banStatus={banStatusForFormat(card, format)}
          blocked={blocked}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Deux intercalaires, comme ailleurs : l'actif se raccorde au panneau en dessous */}
      <div className="flex items-end gap-1 border-b border-edge text-sm">
        {(['search', 'suggestions'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-t-xs px-3 transition-colors',
              tab === id
                ? '-mb-px border border-edge border-b-sheet bg-sheet py-2 font-medium text-ink'
                : 'mt-1 py-1.5 text-ink-faint hover:text-ink-muted',
            )}
          >
            {id === 'suggestions' && <Sparkles className="size-3.5" />}
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
