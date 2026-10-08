'use client';
import type { CardSummaryDto } from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CardImage } from './card-image';

const banTone = {
  Forbidden: 'bg-danger',
  Banned: 'bg-danger',
  Limited: 'bg-warning',
  'Semi-Limited': 'bg-accent',
} as const;
type BanStatus = keyof typeof banTone;
const isBanStatus = (v: string | null | undefined): v is BanStatus => !!v && v in banTone;

/**
 * Vignette de carte. Le badge de quantité possédée est LE signal clé de l'app :
 * vert = je l'ai, discret = je ne l'ai pas.
 */
export function CardTile({
  card,
  onClick,
  footer,
  dimmed,
  className,
}: {
  card: CardSummaryDto;
  onClick?: () => void;
  footer?: React.ReactNode;
  dimmed?: boolean;
  className?: string;
}) {
  const t = useTranslations('cards.ban');
  const owned = card.ownedQuantity;
  const ban = isBanStatus(card.banTcg) ? card.banTcg : null;
  return (
    <div className={cn('group relative flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'pocket relative block w-full rounded-xs p-1 transition-[filter] duration-200',
          'hover:brightness-125',
          dimmed && 'opacity-45 saturate-50 hover:opacity-100 hover:saturate-100',
        )}
        title={card.name}
      >
        <CardImage card={card} />
        {ban && (
          <span
            className={cn(
              'absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full font-mono text-[10px] font-bold text-black',
              banTone[ban],
            )}
            title={t(ban)}
          >
            {ban === 'Limited' ? 1 : ban === 'Semi-Limited' ? 2 : 0}
          </span>
        )}
        {owned !== undefined && owned > 0 && (
          <span className="code absolute right-2 bottom-2 rounded-xs bg-label px-1.5 py-0.5 text-[11px] font-bold text-label-ink">
            ×{owned}
          </span>
        )}
      </button>
      {footer}
    </div>
  );
}

export function CardGrid({ children, dense }: { children: React.ReactNode; dense?: boolean }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        dense
          ? 'grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]'
          : 'grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] md:gap-4',
      )}
    >
      {children}
    </div>
  );
}

/** 9 cartes par page, comme une vraie feuille de classeur. */
const PER_PAGE = 9;

/**
 * Les cartes rangées par pages de neuf pochettes, 3 × 3, avec une gouttière franche entre
 * deux pages. C'est le rythme du classeur, et il rend le comptage immédiat : on sait qu'une
 * page pleine fait neuf sans la lire. À réserver aux vraies grilles de cartes — une liste de
 * résultats hétérogènes n'y gagnerait rien.
 */
export function PocketPages<T>({
  items,
  render,
}: {
  items: readonly T[];
  render: (item: T, index: number) => React.ReactNode;
}) {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-8">
      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="grid w-full grid-cols-3 gap-2 sm:w-[calc(50%-1.25rem)] lg:w-[calc(33.333%-1.667rem)]"
        >
          {page.map((item, index) => render(item, pageIndex * PER_PAGE + index))}
        </div>
      ))}
    </div>
  );
}
