'use client';
import type { CardInteractionGroupDto } from '@ygo/shared';
import { ArrowDownLeft, ArrowUpRight, Network } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/feedback';
import { useCardInteractions } from '@/lib/api/cards';
import { cn } from '@/lib/utils';
import { CardImage } from './card-image';

type Tab = 'OUT' | 'IN';

/**
 * Exploration d'une carte : ce qu'elle va chercher / invoquer / utiliser, et les cartes
 * qui la cherchent / l'invoquent / l'utilisent. Un clic sur une carte ouvre sa fiche.
 */
export function CardInteractions({
  cardId,
  onOpen,
  signedIn,
}: {
  cardId: number;
  onOpen: (cardId: number) => void;
  signedIn: boolean;
}) {
  const t = useTranslations('cards.interactions');
  const { data, isLoading } = useCardInteractions(cardId);
  const [tab, setTab] = useState<Tab | null>(null);
  const [mine, setMine] = useState(false);

  if (isLoading) return <Skeleton className="h-40" />;
  if (!data) return null;

  const out = data.groups.filter((g) => g.direction === 'OUT');
  const inc = data.groups.filter((g) => g.direction === 'IN');
  const current: Tab = tab ?? (out.length ? 'OUT' : 'IN');
  const groups = (current === 'OUT' ? out : inc)
    .map((g) => (mine ? { ...g, cards: g.cards.filter((c) => (c.ownedQuantity ?? 0) > 0) } : g))
    .filter((g) => g.cards.length);
  const empty = !out.length && !inc.length;

  return (
    <section className="space-y-3" aria-labelledby="interactions-title">
      <header className="flex flex-wrap items-center gap-2">
        <h3 id="interactions-title" className="flex items-center gap-2 text-sm font-semibold">
          <Network className="size-4 text-accent" /> {t('title')}
        </h3>
        {data.ownedLinked > 0 && (
          <Badge tone="success">{t('ownedLinked', { count: data.ownedLinked })}</Badge>
        )}
        {signedIn && !empty && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-fg-muted">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            {t('onlyMine')}
          </label>
        )}
      </header>

      {empty ? (
        <p className="text-sm text-fg-subtle">
          {data.indexed ? t('emptyIndexed') : t('emptyIndexing')}
        </p>
      ) : (
        <>
          <div
            role="tablist"
            className="grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-sm"
          >
            <TabButton
              active={current === 'OUT'}
              onClick={() => setTab('OUT')}
              icon={ArrowUpRight}
              label={t('tabs.out')}
              count={out.length}
            />
            <TabButton
              active={current === 'IN'}
              onClick={() => setTab('IN')}
              icon={ArrowDownLeft}
              label={t('tabs.in')}
              count={inc.length}
            />
          </div>

          {groups.length ? (
            <div className="space-y-4">
              {groups.map((g, i) => (
                <Group
                  key={`${g.verb}-${g.target}-${g.precision}-${i}`}
                  group={g}
                  onOpen={onOpen}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-subtle">{mine ? t('noneMine') : t('none')}</p>
          )}
        </>
      )}

      {current === 'OUT' && data.generic.length > 0 && (
        <p className="text-xs text-fg-subtle">
          {t('generic', {
            list: data.generic
              .map((g) => `${t(`out.${g.verb}`).toLowerCase()} ${g.target}`)
              .join(' · '),
          })}
        </p>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Network;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={!count}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition disabled:opacity-40',
        active ? 'bg-bg-elevated shadow-sm' : 'text-fg-muted enabled:hover:text-fg',
      )}
    >
      <Icon className="size-3.5" /> {label}
      <span className="font-mono text-xs text-fg-subtle tabular-nums">{count}</span>
    </button>
  );
}

function Group({
  group,
  onOpen,
}: {
  group: CardInteractionGroupDto;
  onOpen: (cardId: number) => void;
}) {
  const t = useTranslations('cards.interactions');
  const label = t(`${group.direction === 'OUT' ? 'out' : 'in'}.${group.verb}`);
  const more = group.total - group.cards.length;
  return (
    <div>
      <p className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="font-medium">{label}</span>
        {group.target && <span className="text-fg-muted">{group.target}</span>}
        {group.direction === 'IN' && group.precision === 'PRECISE' && (
          <span className="text-xs text-fg-subtle" title={t('byTraitsTitle')}>
            {t('byTraits')}
          </span>
        )}
        <span className="ml-auto font-mono text-xs text-fg-subtle tabular-nums">{group.total}</span>
      </p>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {group.cards.map((c) => {
          const owned = c.ownedQuantity ?? 0;
          return (
            <li key={c.id} className="w-16 shrink-0">
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                title={c.name}
                className="group relative block w-full text-left"
              >
                <CardImage
                  card={c}
                  sizes="64px"
                  className={cn(
                    'transition group-hover:-translate-y-0.5',
                    c.ownedQuantity === 0 && 'opacity-60',
                  )}
                />
                {owned > 0 && (
                  <span className="absolute top-1 right-1 rounded bg-success px-1 font-mono text-[9px] font-bold text-white tabular-nums">
                    ×{owned}
                  </span>
                )}
                <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-fg-muted">
                  {c.name}
                </span>
              </button>
            </li>
          );
        })}
        {more > 0 && (
          <li className="flex w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-fg-subtle">
            +{more}
          </li>
        )}
      </ul>
    </div>
  );
}
