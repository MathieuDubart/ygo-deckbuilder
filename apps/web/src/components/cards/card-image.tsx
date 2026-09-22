'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { CardSummaryDto } from '@ygo/shared';
import { cn } from '@/lib/utils';

const frameTone: Record<string, string> = {
  spell: 'from-spell/40',
  trap: 'from-trap/40',
  fusion: 'from-extra/40',
  synchro: 'from-fg/20',
  xyz: 'from-bg-sunken',
  link: 'from-spell/30',
};

/** Image de carte au bon ratio, avec un placeholder typé si l'image manque. */
export function CardImage({
  card,
  sizes = '(max-width: 768px) 33vw, 180px',
  className,
  priority,
}: {
  card: Pick<CardSummaryDto, 'name' | 'imageUrl' | 'imageUrlSmall' | 'frameType'>;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // Pleine résolution, redimensionnée par Next selon `sizes` → nette sur écran Retina
  const src = card.imageUrl ?? card.imageUrlSmall;
  return (
    <div
      className={cn(
        'relative aspect-(--aspect-card) overflow-hidden rounded-[4%/3%] bg-bg-sunken',
        className,
      )}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={card.name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={cn(
            'flex h-full items-end bg-linear-to-b to-transparent p-2',
            frameTone[card.frameType.split('_')[0] ?? ''] ?? 'from-monster/30',
          )}
        >
          <span className="line-clamp-3 text-[11px] leading-tight font-medium text-fg">
            {card.name}
          </span>
        </div>
      )}
    </div>
  );
}
