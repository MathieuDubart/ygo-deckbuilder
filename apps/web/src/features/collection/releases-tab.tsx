'use client';
import {
  PRODUCT_KINDS,
  RELEASE_PROGRESS_FILTERS,
  RELEASE_STATUSES,
  type FriendSetProgressDto,
  type ReleaseDto,
} from '@ygo/shared';
import { CalendarClock, PackageSearch, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProductCover } from '@/components/products/product-cover';
import { TagFilter } from '@/components/tags/tag-filter';
import { TagList } from '@/components/tags/tag-picker';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Meter, Pagination, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import {
  useReleaseFacets,
  useReleases,
  useReleaseSpotlight,
  type ReleaseParams,
} from '@/lib/api/releases';
import { useFriendsProgress } from '@/lib/api/social';
import { useTags } from '@/lib/api/tags';
import { FriendProgressStrip } from '@/features/social/friend-progress';
import { useFormat } from '@/lib/format';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';
import { FacetBar, FilterToggle, SortSelect } from '@/components/ui/facet-bar';
import { ReleaseDialog } from './release-dialog';

const SORTS = ['date', 'progress', 'name', 'cards'] as const;

/**
 * Suivi par extension : ce qui sort et ce qui vient de sortir en haut, puis toutes les
 * extensions avec leur avancement. L'avancement se lit de deux façons — l'impression exacte
 * ou la carte quelle que soit son édition — et la bascule choisit laquelle compte.
 */
export function ReleasesTab() {
  const t = useTranslations('releases');
  const tp = useTranslations('products.kinds');
  const [params, setParams] = useState<ReleaseParams>({ page: 1, pageSize: 24 });
  const [q, setQ] = useState('');
  const [anyEdition, setAnyEdition] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = { ...params, q: useDebounced(q) || undefined };
  const { data, isLoading, isFetching } = useReleases(query);
  const { data: facets } = useReleaseFacets();
  const { data: tags } = useTags();
  const spotlight = useReleaseSpotlight();
  // Avancement des amis pour la page affichée : une requête, pas une par vignette
  const { data: friendsProgress } = useFriendsProgress(
    (data?.items ?? []).map((release) => release.set.id),
  );

  const set = (patch: ReleaseParams) => setParams((p) => ({ ...p, ...patch, page: 1 }));
  const countOf = (values: { value: string; count: number }[] | undefined, value: string) =>
    values?.find((v) => v.value === value)?.count;

  return (
    <>
      {/* Mise en avant : on ne va pas chercher les sorties, elles viennent à nous */}
      {!spotlight.isLoading && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Spotlight
            icon={CalendarClock}
            title={t('spotlight.upcoming')}
            empty={t('spotlight.upcomingEmpty')}
            releases={spotlight.data?.upcoming ?? []}
            anyEdition={anyEdition}
            onOpen={setOpenId}
          />
          <Spotlight
            icon={Sparkles}
            title={t('spotlight.recent')}
            empty={t('spotlight.recentEmpty')}
            releases={spotlight.data?.recent ?? []}
            anyEdition={anyEdition}
            onOpen={setOpenId}
          />
        </div>
      )}

      <FacetBar
        className="mb-4"
        search={{ value: q, placeholder: t('searchPlaceholder'), onChange: setQ }}
        facets={[
          {
            key: 'status',
            label: t('filters.status'),
            allLabel: t('filters.allStatuses'),
            value: params.status,
            options: RELEASE_STATUSES.map((value) => ({
              value,
              label: t(`status.${value}`),
              count: countOf(facets?.statuses, value),
            })).filter((o) => o.count),
            onChange: (value) => set({ status: value as ReleaseParams['status'] }),
          },
          {
            key: 'kind',
            label: t('filters.kind'),
            allLabel: t('filters.allKinds'),
            value: params.kind,
            options: PRODUCT_KINDS.map((value) => ({
              value,
              label: tp(value),
              count: countOf(facets?.kinds, value),
            })).filter((o) => o.count),
            onChange: (value) => set({ kind: value as ReleaseParams['kind'] }),
          },
          {
            key: 'year',
            label: t('filters.year'),
            allLabel: t('filters.allYears'),
            value: params.year ? String(params.year) : undefined,
            options: (facets?.years ?? []).map(({ value, count }) => ({
              value,
              label: value,
              count,
            })),
            onChange: (value) => set({ year: value ? Number(value) : undefined }),
          },
          {
            key: 'progress',
            label: t('filters.progress'),
            allLabel: t('filters.allProgress'),
            value: params.progress,
            options: RELEASE_PROGRESS_FILTERS.map((value) => ({
              value,
              label: t(`progress.${value}`),
            })),
            onChange: (value) => set({ progress: value as ReleaseParams['progress'] }),
          },
        ]}
      >
        <SortSelect
          label={t('filters.sort')}
          value={params.sort ?? 'date'}
          onChange={(value) => set({ sort: value as ReleaseParams['sort'] })}
          options={SORTS.map((value) => ({
            value,
            label: t('sort.option', { label: t(`sort.${value}`) }),
          }))}
        />
        <FilterToggle
          checked={!!params.ownedProduct}
          onChange={(checked) => set({ ownedProduct: checked || undefined })}
        >
          {t('filters.ownedProduct')}
        </FilterToggle>
        <FilterToggle checked={anyEdition} onChange={setAnyEdition} title={t('anyEditionHint')}>
          {t('anyEdition')}
        </FilterToggle>
      </FacetBar>

      <TagFilter
        value={params.tagIds ?? []}
        onChange={(tagIds) => set({ tagIds: tagIds.length ? tagIds : undefined })}
        counts={(id) => tags?.find((tag) => tag.id === id)?.setCount}
      />

      {data && <p className="mt-3 text-sm text-fg-muted">{t('count', { count: data.total })}</p>}

      <div className="mt-4">
        {isLoading ? (
          <ReleaseGrid>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </ReleaseGrid>
        ) : !data?.items.length ? (
          <EmptyState
            icon={PackageSearch}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
            <ReleaseGrid>
              {data.items.map((release) => (
                <ReleaseCard
                  key={release.set.id}
                  release={release}
                  anyEdition={anyEdition}
                  tagIds={release.tagIds}
                  friends={friendsProgress?.[release.set.id]}
                  onOpen={() => setOpenId(release.set.id)}
                />
              ))}
            </ReleaseGrid>
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
      </div>

      <ReleaseDialog
        setId={openId}
        anyEdition={anyEdition}
        onAnyEditionChange={setAnyEdition}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

const ReleaseGrid = ({ children }: { children: React.ReactNode }) => (
  <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">{children}</ul>
);

/** Compteurs affichés : impression exacte, ou carte toutes éditions confondues. */
function counters(release: ReleaseDto, anyEdition: boolean) {
  const { prints, cards, ownedPrints, ownedCards } = release.progress;
  return anyEdition ? { owned: ownedCards, total: cards } : { owned: ownedPrints, total: prints };
}

function ReleaseCard({
  release,
  anyEdition,
  tagIds,
  friends,
  onOpen,
}: {
  release: ReleaseDto;
  anyEdition: boolean;
  tagIds: string[];
  friends: FriendSetProgressDto[] | undefined;
  onOpen: () => void;
}) {
  const t = useTranslations('releases');
  const { date, number, percent } = useFormat();
  const { data: tags } = useTags();
  const { owned, total } = counters(release, anyEdition);
  const unrevealed = total === 0;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col gap-2.5 rounded-xs border border-edge p-3 text-left transition-colors hover:border-edge-strong hover:bg-ink/3"
      >
        <div className="flex gap-3">
          <div className="pocket shrink-0 rounded-xs p-0.5">
            <ProductCover set={release.set} sizes="80px" className="aspect-[3/4] w-16" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="line-clamp-2 text-sm leading-snug font-medium">{release.set.name}</p>
            <div className="flex flex-wrap items-center gap-1">
              {release.set.code && <Badge>{release.set.code}</Badge>}
              <StatusBadge release={release} />
              {release.ownedProduct && <Badge tone="success">{t('sealed')}</Badge>}
            </div>
            <p className="font-mono text-[11px] text-fg-subtle">
              {release.set.tcgDate ? date(release.set.tcgDate) : t('noDate')}
            </p>
          </div>
        </div>

        {unrevealed ? (
          <p className="mt-auto text-xs text-fg-muted">{t('unrevealed')}</p>
        ) : (
          <div className="mt-auto space-y-1">
            <div className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
              <span>
                {number(owned)} / {number(total)}
              </span>
              <span className={cn(owned >= total ? 'text-success' : 'text-fg-muted')}>
                {percent(total ? owned / total : 0)}
              </span>
            </div>
            <Meter value={owned} total={total} />
          </div>
        )}
        <FriendProgressStrip friends={friends} anyEdition={anyEdition} />
        <TagList tagIds={tagIds} tags={tags} />
      </button>
    </li>
  );
}

function StatusBadge({ release }: { release: ReleaseDto }) {
  const t = useTranslations('releases');
  if (release.status === 'UPCOMING') {
    const days = release.daysUntil ?? 0;
    return <Badge tone="accent">{days === 0 ? t('today') : t('inDays', { count: days })}</Badge>;
  }
  if (release.status === 'RECENT') return <Badge>{t('status.RECENT')}</Badge>;
  return null;
}

function Spotlight({
  icon: Icon,
  title,
  empty,
  releases,
  anyEdition,
  onOpen,
}: {
  icon: typeof CalendarClock;
  title: string;
  empty: string;
  releases: ReleaseDto[];
  anyEdition: boolean;
  onOpen: (setId: string) => void;
}) {
  const { date } = useFormat();
  const t = useTranslations('releases');

  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 border-b border-edge pb-1.5 text-sm font-medium text-ink-muted">
        <Icon className="size-3.5" strokeWidth={1.5} /> {title}
      </h3>
      {!releases.length ? (
        <p className="py-4 text-xs text-ink-faint">{empty}</p>
      ) : (
        <ul className="divide-y divide-edge">
          {releases.map((release) => {
            const { owned, total } = counters(release, anyEdition);
            return (
              <li key={release.set.id}>
                <button
                  type="button"
                  onClick={() => onOpen(release.set.id)}
                  className="flex w-full items-center gap-3 py-1.5 text-left"
                >
                  <ProductCover
                    set={release.set}
                    sizes="40px"
                    className="aspect-[3/4] w-8 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{release.set.name}</span>
                    <span className="font-mono text-[11px] text-fg-subtle">
                      {release.set.tcgDate ? date(release.set.tcgDate) : t('noDate')}
                      {total > 0 && ` · ${owned}/${total}`}
                    </span>
                  </span>
                  <StatusBadge release={release} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
