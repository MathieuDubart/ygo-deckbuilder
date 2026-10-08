'use client';
import { BANLIST_LIMITS, banStatusOf, type BanStatus, type CardSummaryDto } from '@ygo/shared';
import { Ban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CardImage } from './card-image';

/**
 * Fond ET encre : `bg-accent` est presque noir en apparence claire, du texte noir dessus y
 * disparaîtrait. Les deux autres tons sont des couleurs fixes claires.
 */
const banTone: Record<BanStatus, string> = {
  FORBIDDEN: 'bg-danger text-black',
  LIMITED: 'bg-warning text-black',
  SEMI_LIMITED: 'bg-accent text-accent-fg',
};

/**
 * Vignette de carte. Le badge de quantité possédée est LE signal clé de l'app :
 * vert = je l'ai, discret = je ne l'ai pas.
 *
 * `banStatus` est le statut qui s'applique DANS CE CONTEXTE — le format du deck en cours, pas
 * forcément le TCG. Sans lui, la pastille retombe sur la banlist TCG, qui est le défaut de
 * l'app. `blocked` porte la raison pour laquelle la carte ne peut pas être prise : la vignette
 * s'éteint et se barre au lieu de laisser cliquer pour rien.
 */
export function CardTile({
  card,
  onClick,
  footer,
  dimmed,
  banStatus,
  blocked,
  className,
}: {
  card: CardSummaryDto;
  onClick?: () => void;
  footer?: React.ReactNode;
  dimmed?: boolean;
  banStatus?: string | null;
  blocked?: string | null;
  className?: string;
}) {
  const t = useTranslations('cards.ban');
  const owned = card.ownedQuantity;
  const ban = banStatusOf(banStatus === undefined ? card.banTcg : banStatus);
  return (
    <div className={cn('group relative flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'pocket relative block w-full rounded-xs p-1 transition-[filter] duration-200',
          'hover:brightness-125',
          dimmed && 'opacity-45 saturate-50 hover:opacity-100 hover:saturate-100',
          blocked && 'opacity-40 grayscale hover:brightness-100',
        )}
        title={card.name}
      >
        <CardImage card={card} />
        {ban && (
          <span
            className={cn(
              'absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full font-mono text-[10px] font-bold',
              banTone[ban],
            )}
            title={t(ban)}
          >
            {BANLIST_LIMITS[ban]}
          </span>
        )}
        {owned !== undefined && owned > 0 && (
          <span className="code absolute right-2 bottom-2 rounded-xs bg-label px-1.5 py-0.5 text-[11px] font-bold text-label-ink">
            ×{owned}
          </span>
        )}
      </button>
      {/* La raison se lit SOUS la pochette : posée dessus, elle se tronque et recouvre le
          badge de quantité, qui reste l'information la plus utile de la vignette. */}
      {blocked && (
        <p className="flex items-start gap-1 px-0.5 text-danger">
          <Ban className="mt-px size-3 shrink-0" />
          <span className="code text-[10px] leading-tight font-bold">{blocked}</span>
        </p>
      )}
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
