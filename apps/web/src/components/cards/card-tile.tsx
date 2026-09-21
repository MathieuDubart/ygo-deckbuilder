'use client';
import type { CardSummaryDto } from '@ygo/shared';
import { cn } from '@/lib/utils';
import { CardImage } from './card-image';

const banTone: Record<string, string> = {
  Forbidden: 'bg-danger',
  Banned: 'bg-danger',
  Limited: 'bg-warning',
  'Semi-Limited': 'bg-accent',
};

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
  const owned = card.ownedQuantity;
  return (
    <div className={cn('group relative flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'relative block w-full rounded-[4%/3%] transition duration-200',
          'hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-8px] hover:shadow-accent/30',
          dimmed && 'opacity-45 saturate-50 hover:opacity-100 hover:saturate-100',
        )}
        title={card.name}
      >
        <CardImage card={card} />
        {card.banTcg && banTone[card.banTcg] && (
          <span
            className={cn(
              'absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full font-mono text-[10px] font-bold text-black',
              banTone[card.banTcg],
            )}
            title={card.banTcg}
          >
            {card.banTcg === 'Limited' ? 1 : card.banTcg === 'Semi-Limited' ? 2 : 0}
          </span>
        )}
        {owned !== undefined && owned > 0 && (
          <span className="absolute right-1.5 bottom-1.5 rounded-md bg-success px-1.5 py-0.5 font-mono text-[11px] font-bold text-black tabular-nums shadow">
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
