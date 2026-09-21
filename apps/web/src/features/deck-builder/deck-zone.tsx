'use client';
import type { DeckZone as Zone } from '@ygo/shared';
import { DECK_RULES } from '@ygo/shared';
import { CardImage } from '@/components/cards/card-image';
import { cn } from '@/lib/utils';
import type { BuilderEntry } from './use-deck-builder';

const LABELS: Record<Zone, string> = { MAIN: 'Main Deck', EXTRA: 'Extra Deck', SIDE: 'Side Deck' };

/**
 * Une zone du deck. Chaque exemplaire est affiché individuellement (comme sur table),
 * les exemplaires non possédés sont marqués → on voit d'un coup d'œil ce qu'il faut acheter.
 */
export function DeckZone({
  zone,
  entries,
  count,
  onRemove,
  onInspect,
}: {
  zone: Zone;
  entries: BuilderEntry[];
  count: number;
  onRemove: (zone: Zone, cardId: number) => void;
  onInspect: (cardId: number) => void;
}) {
  const { min, max } = DECK_RULES[zone];
  const ok = count >= min && count <= max;
  const copies = entries.flatMap((e) =>
    Array.from({ length: e.quantity }, (_, i) => ({ entry: e, index: i, missing: i >= e.owned })),
  );

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated/60 p-3 md:p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{LABELS[zone]}</h2>
        <span
          className={cn('font-mono text-sm tabular-nums', ok ? 'text-fg-muted' : 'text-warning')}
        >
          {count}
          <span className="text-fg-subtle">/{zone === 'MAIN' ? `${min}–${max}` : max}</span>
        </span>
      </header>
      {copies.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-fg-subtle">
          {zone === 'SIDE'
            ? 'Maj + clic sur une carte pour l’ajouter au side'
            : 'Clique sur une carte à gauche pour l’ajouter'}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-1.5 md:grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]">
          {copies.map(({ entry, index, missing }) => (
            <button
              key={`${entry.card.id}-${index}`}
              type="button"
              title={`${entry.card.name}${missing ? ' — non possédée' : ''}\nClic : retirer · Clic droit : détails`}
              onClick={() => onRemove(zone, entry.card.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onInspect(entry.card.id);
              }}
              className="group relative transition hover:-translate-y-0.5"
            >
              <CardImage
                card={entry.card}
                sizes="72px"
                className={cn(missing && 'opacity-50 grayscale')}
              />
              {missing && (
                <span className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded bg-danger px-1 font-mono text-[9px] font-bold text-white">
                  MANQUE
                </span>
              )}
              <span className="absolute inset-0 hidden place-items-center rounded-[4%/3%] bg-black/50 text-lg font-bold text-white group-hover:grid">
                −
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
