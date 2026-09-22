'use client';
import type {
  DeckZone,
  GeneratedDeckCardDto,
  GeneratedCardSource,
  GenerationMode,
} from '@ygo/shared';
import { AlertTriangle, Check, Layers, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/input';
import { useCreateDeck } from '@/lib/api/decks';
import { useGeneratedDeck, type GenerationTarget } from '@/lib/api/suggestions';
import { useAddToWishlist } from '@/lib/api/wishlist';
import { cn, formatPrice } from '@/lib/utils';
import { ScoreBadge, ScoreBreakdown } from './playable-decks';

const ZONES: { zone: DeckZone; label: string }[] = [
  { zone: 'MAIN', label: 'Main Deck' },
  { zone: 'EXTRA', label: 'Extra Deck' },
  { zone: 'SIDE', label: 'Side Deck' },
];

const SOURCE_LABEL: Partial<Record<GeneratedCardSource, string>> = {
  FLEX: 'Flex',
  STAPLE: 'Staple',
  ARCHETYPE: 'Archétype',
  SUPPORT: 'Support',
  FILLER: 'Complément',
};

/**
 * Aperçu d'un deck généré automatiquement, avant de le créer.
 * Pour un archétype du meta, on bascule entre la liste type et la version « avec mes cartes ».
 */
export function GenerateDeckDialog({
  target,
  onClose,
}: {
  target: GenerationTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<GenerationMode>('OWNED');
  const { data: deck, isLoading, isFetching, error } = useGeneratedDeck(target, mode);
  const [name, setName] = useState('');
  const [wishlistMissing, setWishlistMissing] = useState(true);
  const [inspect, setInspect] = useState<number | null>(null);
  const createDeck = useCreateDeck();
  const addWish = useAddToWishlist();
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Nom proposé = nom du deck généré (modifiable)
  useEffect(() => {
    if (deck) setName(deck.name);
  }, [deck?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (target) setMode('OWNED');
  }, [target]);

  const missing = deck?.cards.filter((c) => c.quantity > c.owned) ?? [];

  async function create() {
    if (!deck) return;
    setSaving(true);
    setCreateError(null);
    try {
      const created = await createDeck.mutateAsync({
        name: name.trim() || deck.name,
        format: 'TCG',
        cards: deck.cards.map((c) => ({ cardId: c.card.id, zone: c.zone, quantity: c.quantity })),
      });
      if (wishlistMissing && missing.length) {
        // Une ligne de wishlist par carte (toutes zones confondues), liée au nouveau deck
        const byCard = new Map<number, number>();
        for (const c of missing)
          byCard.set(c.card.id, (byCard.get(c.card.id) ?? 0) + c.quantity - c.owned);
        for (const [cardId, quantity] of byCard) {
          await addWish.mutateAsync({
            cardId,
            quantity: Math.min(quantity, 3),
            deckId: created.id,
          });
        }
      }
      toast.success(`Deck « ${created.name} » créé`);
      onClose();
      router.push(`/decks/${created.id}`);
    } catch (e) {
      // Affiché dans le panneau : un toast serait masqué par la <dialog> modale
      setCreateError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={target !== null}
        onClose={onClose}
        title={
          target?.kind === 'meta'
            ? `Construire : ${target.name}`
            : `Deck auto : ${target?.archetype ?? ''}`
        }
        variant="sheet"
        className="w-[min(100vw,52rem)]"
      >
        <div className="space-y-5">
          {target?.kind === 'meta' && (
            <div className="grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-sm">
              {(
                [
                  [
                    'OWNED',
                    'Avec mes cartes',
                    'Uniquement ce que tu possèdes, complété par tes staples',
                  ],
                  [
                    'META',
                    'Liste meta complète',
                    'La liste type des tournois, avec ce qu’il te manque',
                  ],
                ] as const
              ).map(([m, label, hint]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  title={hint}
                  className={cn(
                    'rounded-md py-2 font-medium transition',
                    mode === m ? 'bg-bg-elevated shadow-sm' : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error.message}</p>
          ) : isLoading || !deck ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-64" />
            </div>
          ) : (
            <div className={cn('space-y-5 transition', isFetching && 'opacity-60')}>
              <Summary
                counts={deck.counts}
                missingCopies={deck.missingCopies}
                missingCost={deck.missingCost}
                complete={deck.complete}
              />

              {deck.mode !== 'META' && (
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <ScoreBadge score={deck.score.score} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        deck.score.playable ? 'text-success' : 'text-warning',
                      )}
                    >
                      {deck.score.playable
                        ? 'Deck complet et jouable avec tes cartes'
                        : deck.complete
                          ? 'Complet, mais fragile'
                          : 'Incomplet avec ta collection'}
                    </p>
                    <ScoreBreakdown score={deck.score} />
                  </div>
                </div>
              )}

              {deck.notes.length > 0 && (
                <ul className="space-y-1 text-sm text-fg-muted">
                  {deck.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              )}

              {ZONES.map(({ zone, label }) => {
                const cards = deck.cards.filter((c) => c.zone === zone);
                if (!cards.length) return null;
                return (
                  <section key={zone}>
                    <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
                      {label}
                      <span className="font-mono text-xs font-normal text-fg-subtle tabular-nums">
                        {deck.counts[zone]} cartes
                      </span>
                    </h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
                      {cards.map((c) => (
                        <GeneratedCard
                          key={`${zone}-${c.card.id}`}
                          entry={c}
                          onClick={() => setInspect(c.card.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              <div className="sticky -bottom-5 -mx-5 -mb-5 space-y-3 border-t border-border bg-bg-elevated/95 px-5 py-4 backdrop-blur">
                <Field label="Nom du deck">
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                </Field>
                {missing.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-fg-muted">
                    <input
                      type="checkbox"
                      checked={wishlistMissing}
                      onChange={(e) => setWishlistMissing(e.target.checked)}
                    />
                    Mettre les {deck.missingCopies} exemplaire(s) manquant(s) dans ma wishlist
                  </label>
                )}
                {createError && (
                  <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                    {createError}
                  </p>
                )}
                <Button className="w-full" size="lg" loading={saving} onClick={create}>
                  <Wand2 className="size-4" /> Créer ce deck
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
      <CardDetailDialog cardId={inspect} onClose={() => setInspect(null)} />
    </>
  );
}

function Summary({
  counts,
  missingCopies,
  missingCost,
  complete,
}: {
  counts: Record<DeckZone, number>;
  missingCopies: number;
  missingCost: number;
  complete: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryTile
        label="Main / Extra / Side"
        value={`${counts.MAIN} / ${counts.EXTRA} / ${counts.SIDE}`}
        tone={complete ? 'ok' : 'warn'}
      />
      <SummaryTile
        label="Jouable"
        value={complete ? 'Oui' : `${40 - counts.MAIN} cartes manquent`}
        tone={complete ? 'ok' : 'warn'}
        icon={complete ? Check : AlertTriangle}
      />
      <SummaryTile
        label="À acheter"
        value={missingCopies ? `${missingCopies} ex.` : 'Rien'}
        tone={missingCopies ? 'warn' : 'ok'}
      />
      <SummaryTile label="Coût estimé" value={formatPrice(missingCost)} icon={Layers} />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
  icon?: typeof Check;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-sunken/60 px-3 py-2">
      <p className="text-[11px] tracking-wide text-fg-subtle uppercase">{label}</p>
      <p
        className={cn(
          'mt-0.5 flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums',
          tone === 'ok' && 'text-success',
          tone === 'warn' && 'text-warning',
        )}
      >
        {Icon && <Icon className="size-3.5" />}
        {value}
      </p>
    </div>
  );
}

function GeneratedCard({ entry, onClick }: { entry: GeneratedDeckCardDto; onClick: () => void }) {
  const missing = entry.quantity - entry.owned;
  const label = SOURCE_LABEL[entry.source];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left"
      title={[
        entry.card.name,
        entry.inclusion !== null
          ? `Jouée dans ${Math.round(entry.inclusion * 100)} % des listes`
          : null,
        missing > 0 ? `${missing} exemplaire(s) à acheter` : 'Tous possédés',
      ]
        .filter(Boolean)
        .join('\n')}
    >
      <CardImage
        card={entry.card}
        sizes="80px"
        className={cn(
          'transition group-hover:-translate-y-0.5',
          missing === entry.quantity && 'opacity-50 grayscale',
        )}
      />
      <span className="absolute top-1 right-1 rounded bg-black/75 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
        ×{entry.quantity}
      </span>
      {missing > 0 ? (
        <span className="absolute inset-x-1 bottom-1 rounded bg-danger px-1 text-center font-mono text-[9px] font-bold text-white">
          {entry.owned > 0 ? `${entry.owned}/${entry.quantity}` : 'MANQUE'}
        </span>
      ) : (
        label && (
          <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/75 px-1 text-center text-[9px] font-semibold text-accent">
            {label}
          </span>
        )
      )}
    </button>
  );
}
