'use client';
import type { DeckDto, DeckIssue } from '@ygo/shared';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CloudOff,
  Download,
  Heart,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DeckGuide } from '@/features/guide/deck-guide';
import { useUpdateDeck } from '@/lib/api/decks';
import { useAddToWishlist } from '@/lib/api/wishlist';
import { formatPrice } from '@/lib/utils';
import { CardPicker } from './card-picker';
import { DeckZone } from './deck-zone';
import { useDeckBuilder, type SaveStatus } from './use-deck-builder';

export function DeckBuilder({ deck }: { deck: DeckDto }) {
  const b = useDeckBuilder(deck);
  const [inspect, setInspect] = useState<number | null>(null);
  const addWish = useAddToWishlist();
  const rename = useUpdateDeck(deck.id);
  const [name, setName] = useState(deck.name);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideCards = useMemo(
    () =>
      [...b.byZone.MAIN, ...b.byZone.EXTRA, ...b.byZone.SIDE].map((e) => ({
        cardId: e.card.id,
        zone: e.zone,
        quantity: e.quantity,
      })),
    [b.byZone],
  );

  const missingCost = b.missing.reduce((s, m) => s + (m.card.priceCardmarket ?? 0) * m.missing, 0);
  const nameOf = (id: number) =>
    [...b.byZone.MAIN, ...b.byZone.EXTRA, ...b.byZone.SIDE].find((e) => e.card.id === id)?.card
      .name ?? `#${id}`;

  async function addMissingToWishlist() {
    await Promise.all(
      b.missing.map((m) =>
        addWish.mutateAsync({
          cardId: m.card.id,
          quantity: Math.min(m.missing, 3),
          deckId: deck.id,
        }),
      ),
    );
    toast.success(`${b.missing.length} carte(s) ajoutée(s) à la wishlist`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/decks"
          className="rounded-md p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg"
          aria-label="Retour"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== deck.name && rename.mutate({ name: name.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
          aria-label="Nom du deck"
        />
        <SaveIndicator status={b.status} onRetry={b.retry} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setGuideOpen(true)}
          disabled={b.counts.MAIN === 0}
          title="Comment jouer ce deck : plan, combos, erreurs à éviter"
        >
          <BookOpen className="size-4" /> Guide
        </Button>
        <a href={`/api/decks/${deck.id}/export.ydk`} download={`${deck.name}.ydk`}>
          <Button variant="secondary" size="sm">
            <Download className="size-4" /> .ydk
          </Button>
        </a>
      </header>

      {(b.issues.length > 0 || b.missing.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {b.issues.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
              <p className="mb-1.5 flex items-center gap-2 font-medium text-warning">
                <AlertTriangle className="size-4" /> Deck non légal
              </p>
              <ul className="space-y-0.5 text-fg-muted">
                {b.issues.map((i, idx) => (
                  <li key={idx}>{describeIssue(i, nameOf)}</li>
                ))}
              </ul>
            </div>
          )}
          {b.missing.length > 0 && (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
              <p className="text-fg-muted">
                <strong className="text-fg">
                  {b.missing.reduce((s, m) => s + m.missing, 0)} exemplaire(s)
                </strong>{' '}
                non possédé(s) · environ{' '}
                <strong className="text-fg">{formatPrice(missingCost)}</strong>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {b.missing.slice(0, 6).map((m) => (
                  <Badge key={m.card.id} tone="danger">
                    {m.missing}× {m.card.name}
                  </Badge>
                ))}
                {b.missing.length > 6 && <Badge>+{b.missing.length - 6}</Badge>}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={addMissingToWishlist}
                loading={addWish.isPending}
              >
                <Heart className="size-4" /> Tout mettre en wishlist
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-1">
          <CardPicker
            deckId={deck.id}
            onInspect={setInspect}
            onPick={(card, zone) => {
              const r = b.add(card, zone);
              if (!r.ok) toast.warning(r.reason);
            }}
          />
        </aside>
        <div className="space-y-4">
          <DeckZone
            zone="MAIN"
            entries={b.byZone.MAIN}
            count={b.counts.MAIN}
            onRemove={b.removeOne}
            onInspect={setInspect}
          />
          <DeckZone
            zone="EXTRA"
            entries={b.byZone.EXTRA}
            count={b.counts.EXTRA}
            onRemove={b.removeOne}
            onInspect={setInspect}
          />
          <DeckZone
            zone="SIDE"
            entries={b.byZone.SIDE}
            count={b.counts.SIDE}
            onRemove={b.removeOne}
            onInspect={setInspect}
          />
        </div>
      </div>

      <Dialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={`Guide : ${name}`}
        variant="sheet"
        className="w-[min(100vw,44rem)]"
      >
        {guideOpen && <DeckGuide cards={guideCards} name={name} onInspect={setInspect} />}
      </Dialog>
      <CardDetailDialog cardId={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const map = {
    saved: { icon: Check, label: 'Enregistré', cls: 'text-fg-subtle' },
    dirty: { icon: Loader2, label: 'Modifié', cls: 'text-fg-subtle' },
    saving: { icon: Loader2, label: 'Enregistrement…', cls: 'text-fg-muted [&>svg]:animate-spin' },
    error: { icon: CloudOff, label: 'Échec — réessayer', cls: 'text-danger cursor-pointer' },
  }[status];
  const Icon = map.icon;
  return (
    <button
      type="button"
      disabled={status !== 'error'}
      onClick={onRetry}
      className={`flex items-center gap-1.5 text-xs ${map.cls}`}
      aria-live="polite"
    >
      <Icon className="size-3.5" /> {map.label}
    </button>
  );
}

function describeIssue(i: DeckIssue, nameOf: (id: number) => string): string {
  switch (i.code) {
    case 'ZONE_TOO_SMALL':
      return `${i.zone} : ${i.count} cartes (minimum ${i.limit})`;
    case 'ZONE_TOO_LARGE':
      return `${i.zone} : ${i.count} cartes (maximum ${i.limit})`;
    case 'TOO_MANY_COPIES':
      return `${nameOf(i.cardId)} : ${i.count} exemplaires (max ${i.limit})`;
    case 'WRONG_ZONE':
      return `${nameOf(i.cardId)} n’a rien à faire dans le ${i.zone}`;
  }
}
