'use client';
import type { DuelCardDto, DuelCardRef } from '@ygo/shared';
import { EyeOff } from 'lucide-react';
import { CardImage } from '@/components/cards/card-image';
import { cn } from '@/lib/utils';
import type { CardMap } from './duel-utils';

/** Dos de carte (générique, aux couleurs de l'app). */
export function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-(--aspect-card) overflow-hidden rounded-[4%/3%] border border-black/40',
        'bg-[radial-gradient(ellipse_at_center,oklch(0.42_0.09_40)_0%,oklch(0.27_0.06_35)_55%,oklch(0.18_0.04_30)_100%)]',
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-[9%] rounded-[50%] border border-accent/35" />
      <div className="absolute inset-[30%] rounded-full bg-accent/15 blur-[2px]" />
    </div>
  );
}

/** Face d'une carte du duel : visuel si on la connaît, dos sinon. */
export function DuelCardFace({
  card,
  cards,
  sizes = '80px',
  className,
}: {
  card: Pick<DuelCardRef, 'code'> & { position?: DuelCardDto['position'] };
  cards: CardMap;
  sizes?: string;
  className?: string;
}) {
  const summary = card.code ? cards[card.code] : undefined;
  if (!summary) return <CardBack className={className} />;
  const faceDown = card.position === 'FD_ATK' || card.position === 'FD_DEF';
  return (
    <div className={cn('relative', className)}>
      <CardImage card={summary} sizes={sizes} />
      {faceDown && (
        // Ta carte posée : visible pour toi, mais on rappelle qu'elle est face verso
        <div className="absolute inset-0 flex items-start justify-end rounded-[4%/3%] bg-black/45 p-1">
          <EyeOff className="size-3 text-white/80" />
        </div>
      )}
    </div>
  );
}

/** Carte posée sur le Terrain : position (rotation en Défense), ATK/DEF, Matériels. */
export function FieldCard({
  card,
  cards,
  showStats,
}: {
  card: DuelCardDto;
  cards: CardMap;
  showStats: boolean;
}) {
  const defense = card.position === 'DEF' || card.position === 'FD_DEF';
  const faceUp = card.position === 'ATK' || card.position === 'DEF';
  return (
    <div className="relative flex size-full items-center justify-center">
      <div className={cn('w-full transition-transform', defense && 'rotate-90 scale-[0.69]')}>
        <DuelCardFace card={card} cards={cards} />
      </div>
      {card.overlays.length > 0 && (
        <span className="absolute top-0.5 left-0.5 rounded bg-extra px-1 font-mono text-[9px] font-bold text-black">
          {card.overlays.length}
        </span>
      )}
      {card.counters > 0 && (
        <span className="absolute top-0.5 right-0.5 rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-fg">
          {card.counters}
        </span>
      )}
      {showStats && faceUp && card.attack !== null && (
        <span className="absolute inset-x-0 -bottom-1 mx-auto w-fit rounded bg-black/80 px-1 font-mono text-[9px] leading-tight font-semibold whitespace-nowrap text-white tabular-nums">
          {card.attack}
          {card.link === null && card.defense !== null && (
            <span className="text-white/60">/{card.defense}</span>
          )}
          {card.link !== null && <span className="text-spell"> L{card.link}</span>}
        </span>
      )}
    </div>
  );
}
