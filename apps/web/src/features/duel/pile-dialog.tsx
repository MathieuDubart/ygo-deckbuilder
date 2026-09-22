'use client';
import type { DuelActionDto, DuelCardDto } from '@ygo/shared';
import { useTranslations } from 'next-intl';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useActionLabel } from './action-menu';
import type { Pile } from './duel-board';
import { DuelCardFace } from './duel-card';
import { refKey, type CardMap } from './duel-utils';

/** Contenu d'un Cimetière, des cartes bannies ou d'un Extra Deck, avec les actions possibles. */
export function PileDialog({
  open,
  title,
  list,
  cards,
  actions,
  onAction,
  onInspect,
  onClose,
}: {
  open: boolean;
  title: string;
  list: DuelCardDto[];
  cards: CardMap;
  actions: Map<string, DuelActionDto[]>;
  onAction: (a: DuelActionDto) => void;
  onInspect: (code: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('duel.board');
  const label = useActionLabel();
  // Le dessus de la pile en premier
  const ordered = [...list].reverse();
  return (
    <Dialog open={open} onClose={onClose} title={title} className="w-[min(94vw,44rem)]">
      {!ordered.length ? (
        <p className="text-sm text-fg-muted">{t('emptyPile')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {ordered.map((card) => {
            const own = actions.get(refKey(card)) ?? [];
            return (
              <li key={refKey(card)} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => card.code && onInspect(card.code)}
                  className={cn(
                    'rounded-[4%/3%] transition hover:brightness-110',
                    own.length && 'ring-2 ring-accent',
                  )}
                >
                  <DuelCardFace card={card} cards={cards} sizes="120px" />
                </button>
                {own.map((a) => (
                  <button
                    key={`${a.kind}-${a.index}`}
                    onClick={() => onAction(a)}
                    title={a.description ?? undefined}
                    className="rounded-md bg-accent/15 px-2 py-1 text-left text-xs font-medium text-accent hover:bg-accent/25"
                  >
                    {label(a)}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
