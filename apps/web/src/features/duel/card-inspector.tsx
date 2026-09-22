'use client';
import type { CardSummaryDto } from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/feedback';
import { useCard } from '@/lib/api/cards';

/** Carte survolée ou choisie : visuel et texte complet dans ta langue. */
export function CardInspector({ card }: { card: CardSummaryDto | null }) {
  const t = useTranslations('duel.inspector');
  const detail = useCard(card?.id ?? null);
  if (!card)
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-fg-subtle">
        {t('empty')}
      </div>
    );
  const d = detail.data?.id === card.id ? detail.data : null;
  return (
    <div className="flex flex-col gap-3">
      <CardImage card={card} sizes="256px" className="mx-auto w-full max-w-56" />
      <div className="space-y-1.5">
        <p className="leading-tight font-semibold">{card.name}</p>
        <div className="flex flex-wrap gap-1">
          <Badge>{card.type}</Badge>
          {card.attribute && <Badge>{card.attribute}</Badge>}
          {card.race && <Badge>{card.race}</Badge>}
          {card.level !== null && <Badge tone="accent">★ {card.level}</Badge>}
          {card.atk !== null && (
            <Badge>
              {card.atk}
              {card.def !== null && ` / ${card.def}`}
            </Badge>
          )}
        </div>
      </div>
      {detail.isLoading ? (
        <Skeleton className="h-24" />
      ) : d ? (
        <p className="text-xs leading-relaxed whitespace-pre-line text-fg-muted">{d.desc}</p>
      ) : null}
    </div>
  );
}
