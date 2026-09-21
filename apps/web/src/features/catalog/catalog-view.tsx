'use client';
import { SearchX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardFilters } from '@/components/cards/card-filters';
import { CardGrid, CardTile } from '@/components/cards/card-tile';
import { EmptyState, PageHeader, Pagination, Skeleton } from '@/components/ui/feedback';
import { parsePrintCode } from '@ygo/shared';
import { useCardSearch, type CardSearchParams } from '@/lib/api/cards';
import { useDebounced } from '@/lib/hooks/use-debounced';

export function CatalogView() {
  const initialArchetype = useSearchParams().get('archetype') ?? undefined;
  const [params, setParams] = useState<CardSearchParams>({
    page: 1,
    pageSize: 48,
    archetype: initialArchetype,
  });
  const debounced = useDebounced(params);
  const { data, isLoading, isFetching } = useCardSearch(debounced);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <>
      <PageHeader
        title="Catalogue"
        description={
          data ? `${data.total.toLocaleString('fr-FR')} cartes` : 'Toutes les cartes Yu-Gi-Oh!'
        }
      />
      <div className="sticky top-0 z-20 -mx-4 mb-6 bg-bg/85 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        <CardFilters value={params} onChange={setParams} />
      </div>

      {isLoading ? (
        <CardGrid>
          {Array.from({ length: 24 }, (_, i) => (
            <Skeleton key={i} className="aspect-(--aspect-card)" />
          ))}
        </CardGrid>
      ) : !data?.items.length ? (
        <EmptyState
          icon={SearchX}
          title="Aucune carte trouvée"
          description="Essaie un autre nom, ou retire des filtres. Si le catalogue est vide, lance la synchronisation (pnpm cards:sync)."
        />
      ) : (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          {data.approximate && (
            <p className="mb-4 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg-muted">
              Aucun résultat exact pour « {debounced.q} » — voici les cartes qui s’en approchent.
            </p>
          )}
          <CardGrid>
            {data.items.map((card) => (
              <CardTile key={card.id} card={card} onClick={() => setSelected(card.id)} />
            ))}
          </CardGrid>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(page) => {
              setParams((p) => ({ ...p, page }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      <CardDetailDialog
        cardId={selected}
        onClose={() => setSelected(null)}
        printCodeHint={debounced.q && parsePrintCode(debounced.q) ? debounced.q : undefined}
      />
    </>
  );
}
