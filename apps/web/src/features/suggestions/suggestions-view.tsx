'use client';
import type { MetaDeckSuggestionDto } from '@ygo/shared';
import { RefreshCw, Sparkles, Trophy, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/feedback';
import { useMe } from '@/lib/api/auth';
import {
  useArchetypeSuggestions,
  useMetaStatus,
  useMetaSuggestions,
  useMetaSync,
  type GenerationTarget,
} from '@/lib/api/suggestions';
import { cn, formatPercent, formatPrice } from '@/lib/utils';
import { GenerateDeckDialog } from './generate-deck-dialog';

export function SuggestionsView() {
  const meta = useMetaSuggestions();
  const archetypes = useArchetypeSuggestions();
  const [target, setTarget] = useState<GenerationTarget | null>(null);

  return (
    <>
      <PageHeader
        title="Suggestions"
        description="Les decks du moment, ce que ta collection permet déjà, et des decks construits pour toi."
        actions={<MetaStatusBar />}
      />

      <section className="mb-12">
        <SectionTitle icon={Trophy}>Decks du meta · les plus accessibles pour toi</SectionTitle>
        {meta.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : !meta.data?.length ? (
          <EmptyState
            icon={Trophy}
            title="Pas encore de données de tournoi"
            description="Le meta se calcule automatiquement à partir des tops de tournois récents (YGOPRODeck). La première mise à jour se fait au démarrage de l’API, puis chaque lundi."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {meta.data.map((s) => (
              <MetaDeckCard
                key={s.metaDeckId}
                s={s}
                onBuild={() => setTarget({ kind: 'meta', metaDeckId: s.metaDeckId, name: s.name })}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle icon={Sparkles}>
          Depuis ta collection · un deck auto par archétype
        </SectionTitle>
        {archetypes.data?.length ? (
          <div className="flex flex-wrap gap-2">
            {archetypes.data.map((a) => (
              <button
                key={a.archetype}
                onClick={() => setTarget({ kind: 'archetype', archetype: a.archetype })}
                className="group flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm transition hover:border-accent/50"
              >
                <Wand2 className="size-3.5 text-fg-subtle transition group-hover:text-accent" />
                <span className="font-medium">{a.archetype}</span>
                <span className="font-mono text-xs text-fg-subtle">
                  {a.distinctCards} cartes · {a.totalCopies} ex.
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">
            Ajoute des cartes à ta collection pour voir émerger des archétypes à construire.
          </p>
        )}
      </section>

      <GenerateDeckDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Trophy;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
      <Icon className="size-4 text-accent" /> {children}
    </h2>
  );
}

function MetaStatusBar() {
  const { data: me } = useMe();
  const { data: status } = useMetaStatus();
  const sync = useMetaSync();
  return (
    <div className="flex items-center gap-3 text-xs text-fg-subtle">
      {status?.lastSyncAt && (
        <span>
          Meta mis à jour le {new Date(status.lastSyncAt).toLocaleDateString('fr-FR')}
          {status.lastStatus === 'OK' ? ` · ${status.cardCount} listes` : ' · échec'}
        </span>
      )}
      {me?.role === 'ADMIN' && (
        <Button
          variant="secondary"
          size="sm"
          loading={sync.isPending}
          onClick={() =>
            sync.mutate(undefined, {
              onSuccess: (r) =>
                toast.success(`${r.archetypes} archétypes calculés à partir de ${r.lists} listes`),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          <RefreshCw className="size-3.5" /> Mettre à jour
        </Button>
      )}
    </div>
  );
}

function MetaDeckCard({ s, onBuild }: { s: MetaDeckSuggestionDto; onBuild: () => void }) {
  const playable = s.missing.length === 0;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated transition hover:border-border-strong">
      {/* Illustration de la carte phare, recadrée en bandeau */}
      <div className="relative h-24 overflow-hidden bg-bg-sunken">
        {s.coverImageUrl && (
          <Image
            src={s.coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="scale-150 object-cover object-[50%_28%] opacity-60 transition duration-500 group-hover:opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-bg-elevated via-bg-elevated/40 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {s.tier !== null && <Badge tone="accent">Tier {s.tier}</Badge>}
          {s.source === 'tournaments' && s.share !== null && (
            <Badge>{formatPercent(s.share).replace(' ', '')} du meta</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold" title={s.name}>
              {s.name}
            </p>
            <p className="truncate text-xs text-fg-subtle">
              {s.listCount > 0 ? `${s.listCount} liste(s) de tournoi` : 'Liste importée'}
              {s.variants.length > 0 && ` · aussi « ${s.variants[0]} »`}
            </p>
          </div>
          <CoverageRing value={s.coverage} />
        </div>

        <p className="text-sm text-fg-muted">
          {playable ? (
            <span className="text-success">Tu peux le jouer tel quel.</span>
          ) : (
            <>
              {s.ownedCopies}/{s.requiredCopies} exemplaires · il manque{' '}
              <strong className="text-fg">{formatPrice(s.estimatedCostToComplete)}</strong>
            </>
          )}
        </p>

        <Button
          className="mt-auto"
          variant={s.coverage >= 0.5 ? 'primary' : 'secondary'}
          onClick={onBuild}
        >
          <Wand2 className="size-4" /> Construire ce deck
        </Button>
      </div>
    </li>
  );
}

function CoverageRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = value >= 0.8 ? 'text-success' : value >= 0.5 ? 'text-accent' : 'text-fg-subtle';
  return (
    <div className="relative size-12 shrink-0" title="Part de la liste type que tu possèdes déjà">
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
