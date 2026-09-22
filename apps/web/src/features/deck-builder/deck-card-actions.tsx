'use client';
import { DECK_RULES, maxCopiesFor, type CardSummaryDto, type DeckZone } from '@ygo/shared';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { BuilderEntry } from './use-deck-builder';

const LABELS: Record<DeckZone, string> = {
  MAIN: 'Main Deck',
  EXTRA: 'Extra Deck',
  SIDE: 'Side Deck',
};

/**
 * Bloc « Dans ce deck » de la fiche carte (deck builder) : exemplaires par zone, + / −,
 * limites (3 max, banlist) et possession. Les erreurs sont affichées ici : un toast
 * serait masqué par la fiche (dialog modale).
 */
export function DeckCardActions({
  card,
  byZone,
  counts,
  ocg,
  onAdd,
  onRemove,
}: {
  card: CardSummaryDto;
  byZone: Record<DeckZone, BuilderEntry[]>;
  counts: Record<DeckZone, number>;
  ocg: boolean;
  onAdd: (card: CardSummaryDto, zone: DeckZone) => { ok: boolean; reason?: string };
  onRemove: (zone: DeckZone, cardId: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const zones: DeckZone[] = card.isExtraDeck ? ['EXTRA', 'SIDE'] : ['MAIN', 'SIDE'];
  const qty = (z: DeckZone) => byZone[z].find((e) => e.card.id === card.id)?.quantity ?? 0;
  const total = (['MAIN', 'EXTRA', 'SIDE'] as const).reduce((s, z) => s + qty(z), 0);
  const limit = ocg ? DECK_RULES.MAX_COPIES : maxCopiesFor(card.banTcg);
  const owned = card.ownedQuantity ?? 0;

  if (card.category === 'SKILL' || card.category === 'TOKEN') return null;

  return (
    <section
      aria-label="Dans ce deck"
      className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">Dans ce deck</h3>
        <span className="font-mono text-xs text-fg-muted tabular-nums">
          {total}/{limit} exemplaire{limit > 1 ? 's' : ''}
          {!ocg && card.banTcg ? ` · ${card.banTcg}` : ''}
        </span>
        <span
          className={cn(
            'ml-auto font-mono text-xs tabular-nums',
            owned >= total ? 'text-success' : 'text-danger',
          )}
        >
          {owned} possédée{owned > 1 ? 's' : ''}
          {total > owned && ` · ${total - owned} à acheter`}
        </span>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {zones.map((z) => {
          const n = qty(z);
          return (
            <div
              key={z}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{LABELS[z]}</p>
                <p className="font-mono text-[11px] text-fg-subtle tabular-nums">
                  {counts[z]}/{DECK_RULES[z].max} cartes
                </p>
              </div>
              <StepButton
                label={`Retirer un exemplaire du ${LABELS[z]}`}
                disabled={n === 0}
                onClick={() => {
                  setError(null);
                  onRemove(z, card.id);
                }}
              >
                <Minus className="size-4" />
              </StepButton>
              <span className="w-6 text-center font-mono text-base font-semibold tabular-nums">
                {n}
              </span>
              <StepButton
                label={`Ajouter un exemplaire au ${LABELS[z]}`}
                disabled={total >= limit}
                primary
                onClick={() => {
                  const r = onAdd(card, z);
                  setError(r.ok ? null : (r.reason ?? 'Impossible d’ajouter'));
                }}
              >
                <Plus className="size-4" />
              </StepButton>
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function StepButton({
  label,
  disabled,
  primary,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35',
        primary
          ? 'border-accent/40 bg-accent text-accent-fg enabled:hover:brightness-110'
          : 'border-border bg-bg-sunken text-fg enabled:hover:border-border-strong',
      )}
    >
      {children}
    </button>
  );
}
