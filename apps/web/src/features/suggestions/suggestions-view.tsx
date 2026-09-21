'use client';
import type { MetaDeckSuggestionDto } from '@ygo/shared';
import { ChevronDown, Heart, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/feedback';
import { useArchetypeSuggestions, useMetaSuggestions } from '@/lib/api/suggestions';
import { useAddToWishlist } from '@/lib/api/wishlist';
import { cn, formatPercent, formatPrice } from '@/lib/utils';

export function SuggestionsView() {
  const meta = useMetaSuggestions();
  const archetypes = useArchetypeSuggestions();

  return (
    <>
      <PageHeader
        title="Suggestions"
        description="Ce que ta collection te permet de jouer — et ce qu’il te manque pour y arriver."
      />

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          <Trophy className="size-4 text-accent" /> Decks meta les plus accessibles
        </h2>
        {meta.isLoading ? (
          <Skeleton className="h-48" />
        ) : !meta.data?.length ? (
          <EmptyState
            icon={Trophy}
            title="Aucun deck meta de référence"
            description="Un admin doit importer des decklists (.ydk) via POST /meta-decks/import-ydk. Une page d’admin arrive bientôt."
          />
        ) : (
          <ul className="space-y-3">
            {meta.data.map((s) => (
              <MetaDeckRow key={s.metaDeckId} s={s} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          <Sparkles className="size-4 text-accent" /> Tes archétypes les plus fournis
        </h2>
        {archetypes.data?.length ? (
          <div className="flex flex-wrap gap-2">
            {archetypes.data.map((a) => (
              <Link
                key={a.archetype}
                href={`/cards?archetype=${encodeURIComponent(a.archetype)}`}
                className="rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm transition hover:border-accent/50"
              >
                <span className="font-medium">{a.archetype}</span>
                <span className="ml-2 font-mono text-xs text-fg-subtle">
                  {a.distinctCards} cartes · {a.totalCopies} ex.
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">
            Ajoute des cartes à ta collection pour voir émerger des pistes.
          </p>
        )}
      </section>
    </>
  );
}

function MetaDeckRow({ s }: { s: MetaDeckSuggestionDto }) {
  const [open, setOpen] = useState(false);
  const addWish = useAddToWishlist();
  const pct = s.coverage;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        <CoverageRing value={pct} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{s.name}</p>
            {s.tier !== null && <Badge tone="accent">Tier {s.tier}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-fg-muted">
            {s.ownedCopies}/{s.requiredCopies} exemplaires ·{' '}
            {s.missing.length === 0 ? (
              <span className="text-success">jouable tel quel</span>
            ) : (
              <>
                il manque{' '}
                <strong className="text-fg">{formatPrice(s.estimatedCostToComplete)}</strong>
              </>
            )}
          </p>
        </div>
        <ChevronDown className={cn('size-4 text-fg-subtle transition', open && 'rotate-180')} />
      </button>
      {open && s.missing.length > 0 && (
        <div className="border-t border-border p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
            {s.missing.map((m) => (
              <div key={`${m.zone}-${m.card.id}`} className="space-y-1">
                <CardImage card={m.card} sizes="72px" />
                <p className="text-center font-mono text-[10px] text-fg-muted">
                  {m.missing}× · {formatPrice(m.unitPrice)}
                </p>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            loading={addWish.isPending}
            onClick={async () => {
              await Promise.all(
                s.missing.map((m) =>
                  addWish.mutateAsync({ cardId: m.card.id, quantity: Math.min(m.missing, 3) }),
                ),
              );
              toast.success('Cartes manquantes ajoutées à la wishlist');
            }}
          >
            <Heart className="size-4" /> Tout mettre en wishlist
          </Button>
        </div>
      )}
    </li>
  );
}

function CoverageRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = value >= 0.8 ? 'text-success' : value >= 0.5 ? 'text-accent' : 'text-fg-subtle';
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className={cn('stroke-current transition-all', tone)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold tabular-nums">
        {formatPercent(value).replace(' ', '')}
      </span>
    </div>
  );
}
