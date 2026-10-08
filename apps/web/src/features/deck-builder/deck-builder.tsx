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
  Scissors,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DeckGuide } from '@/features/guide/deck-guide';
import { useRefreshBanlist } from '@/lib/api/banlist';
import { useUpdateDeck } from '@/lib/api/decks';
import { useAddToWishlist } from '@/lib/api/wishlist';
import { useFormat } from '@/lib/format';
import { CardPicker } from './card-picker';
import { DeckCardActions } from './deck-card-actions';
import { DeckZone } from './deck-zone';
import { useDeckBuilder, type SaveStatus } from './use-deck-builder';

export function DeckBuilder({ deck }: { deck: DeckDto }) {
  const t = useTranslations('deckBuilder');
  const tc = useTranslations('common');
  const { price } = useFormat();
  const b = useDeckBuilder(deck);
  const [inspect, setInspect] = useState<number | null>(null);
  const addWish = useAddToWishlist();
  const rename = useUpdateDeck(deck.id);
  const [name, setName] = useState(deck.name);
  const [guideOpen, setGuideOpen] = useState(false);

  /**
   * La banlist est relue à l'ouverture du deck. Le deck s'affiche sans attendre — on travaille
   * avec la liste connue — et si le serveur signale un changement, les requêtes se rechargent
   * et le bandeau d'anomalies se met à jour tout seul. Une fois par montage : le serveur borne
   * déjà la fréquence réelle par l'âge de la dernière lecture.
   */
  const refreshBanlist = useRefreshBanlist();
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshBanlist.mutate(undefined, {
      onSuccess: (status) => status.changed && toast.info(t('banlist.updated')),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function describeIssue(i: DeckIssue): string {
    switch (i.code) {
      case 'ZONE_TOO_SMALL':
        return t('issues.zoneTooSmall', {
          zone: tc(`zones.${i.zone}`),
          count: i.count,
          limit: i.limit,
        });
      case 'ZONE_TOO_LARGE':
        return t('issues.zoneTooLarge', {
          zone: tc(`zones.${i.zone}`),
          count: i.count,
          limit: i.limit,
        });
      case 'FORBIDDEN':
        // Pas « 2 exemplaires sur 0 » : une interdiction n'est pas un quota
        return t('issues.forbidden', { name: nameOf(i.cardId), count: i.count });
      case 'TOO_MANY_COPIES':
        return t('issues.tooManyCopies', {
          name: nameOf(i.cardId),
          count: i.count,
          limit: i.limit,
        });
      case 'WRONG_ZONE':
        return t('issues.wrongZone', { name: nameOf(i.cardId), zone: tc(`zones.${i.zone}`) });
    }
  }

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
    toast.success(t('missing.added', { count: b.missing.length }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/decks"
          className="rounded-md p-1.5 text-fg-muted hover:bg-ink/5 hover:text-fg"
          aria-label={tc('actions.back')}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== deck.name && rename.mutate({ name: name.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-xs bg-transparent px-1 text-2xl font-semibold outline-none hover:bg-ink/5 focus:shadow-[inset_0_0_0_1px_var(--edge-strong)]"
          aria-label={t('header.nameLabel')}
        />
        <SaveIndicator status={b.status} onRetry={b.retry} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setGuideOpen(true)}
          disabled={b.counts.MAIN === 0}
          title={t('header.guideHint')}
        >
          <BookOpen className="size-4" /> {t('header.guide')}
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
            <div className="rounded-xs border border-warning/35 p-3 text-sm">
              <p className="mb-1.5 flex items-center gap-2 font-medium text-warning">
                <AlertTriangle className="size-4" /> {t('issues.title')}
              </p>
              <ul className="space-y-0.5 text-fg-muted">
                {b.issues.map((i, idx) => (
                  <li key={idx}>{describeIssue(i)}</li>
                ))}
              </ul>
              {/* Seules les anomalies de banlist se réparent toutes seules : une zone trop
                  petite ou un monstre dans la mauvaise zone demandent un choix de joueur */}
              {b.fixes.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2.5"
                  onClick={() => {
                    const removed = b.fixes.reduce((sum, f) => sum + f.remove, 0);
                    b.applyBanlistFixes();
                    toast.success(t('issues.fixed', { count: removed }));
                  }}
                >
                  <Scissors className="size-4" /> {t('issues.fix')}
                </Button>
              )}
            </div>
          )}
          {b.missing.length > 0 && (
            <div className="flex flex-col justify-between gap-3 rounded-xs border border-danger/35 p-3 text-sm">
              <p className="text-fg-muted">
                {t.rich('missing.summary', {
                  count: b.missing.reduce((s, m) => s + m.missing, 0),
                  cost: price(missingCost),
                  strong: (c) => <strong className="text-fg">{c}</strong>,
                })}
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
                <Heart className="size-4" /> {t('missing.addAll')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-1">
          <CardPicker
            deckId={deck.id}
            format={deck.format}
            onInspect={setInspect}
            blockedReason={b.blockedReason}
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
        title={t('header.guideDialogTitle', { name })}
        variant="sheet"
        className="w-[min(100vw,44rem)]"
      >
        {guideOpen && <DeckGuide cards={guideCards} name={name} onInspect={setInspect} />}
      </Dialog>
      <CardDetailDialog
        cardId={inspect}
        onClose={() => setInspect(null)}
        actions={(card) => (
          <DeckCardActions
            card={card}
            byZone={b.byZone}
            counts={b.counts}
            format={deck.format}
            onAdd={b.add}
            onRemove={b.removeOne}
          />
        )}
      />
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const t = useTranslations('deckBuilder.save');
  const map = {
    saved: { icon: Check, cls: 'text-fg-subtle' },
    dirty: { icon: Loader2, cls: 'text-fg-subtle' },
    saving: { icon: Loader2, cls: 'text-fg-muted [&>svg]:animate-spin' },
    error: { icon: CloudOff, cls: 'text-danger cursor-pointer' },
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
      <Icon className="size-3.5" /> {t(status)}
    </button>
  );
}
