'use client';
import type { DeckScoreDto, PlayableDeckDto } from '@ygo/shared';
import { PackageOpen, ShieldCheck, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { usePlayableDecks, type GenerationTarget } from '@/lib/api/suggestions';
import { cn } from '@/lib/utils';

/**
 * Decks complets (40 cartes), légaux et jouables montables UNIQUEMENT avec la collection,
 * du plus solide au moins solide. Calculés automatiquement, pas besoin de chercher.
 */
export function PlayableDecks({ onOpen }: { onOpen: (target: GenerationTarget) => void }) {
  const { data, isLoading } = usePlayableDecks();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-60" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Pas encore de deck complet avec ta collection"
        description="Il faut un archétype assez fourni (une dizaine de cartes différentes) ou une bonne partie d’un deck du meta. Un Structure Deck est souvent le meilleur point de départ."
        action={
          <Link href="/collection">
            <Button variant="secondary">
              <PackageOpen className="size-4" /> Ajouter un produit
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((p, i) => (
        <PlayableDeckCard
          key={`${p.target.kind}-${p.name}`}
          deck={p}
          best={i === 0}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

function PlayableDeckCard({
  deck,
  best,
  onOpen,
}: {
  deck: PlayableDeckDto;
  best: boolean;
  onOpen: (target: GenerationTarget) => void;
}) {
  return (
    <li
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border bg-bg-elevated transition hover:border-border-strong',
        best ? 'border-accent/40' : 'border-border',
      )}
    >
      {/* Cartes phares en éventail */}
      <div className="relative flex h-36 items-end justify-center overflow-hidden bg-bg-sunken px-4 pt-4">
        {deck.highlights.map((card, i) => {
          const offset = i - (deck.highlights.length - 1) / 2;
          return (
            <div
              key={card.id}
              className="-mx-3 w-20 shrink-0 transition duration-300 group-hover:-translate-y-1"
              style={{
                transform: `rotate(${offset * 7}deg) translateY(${Math.abs(offset) * 6 + 18}px)`,
              }}
            >
              <CardImage card={card} sizes="80px" className="shadow-lg shadow-black/40" />
            </div>
          );
        })}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {best && <Badge tone="accent">Meilleur choix</Badge>}
          {deck.tier !== null ? <Badge>Meta · Tier {deck.tier}</Badge> : <Badge>Deck maison</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold" title={deck.name}>
              {deck.name}
            </p>
            <p className="flex items-center gap-1 text-xs text-success">
              <ShieldCheck className="size-3.5" /> 100 % tes cartes · {deck.counts.MAIN} main ·{' '}
              {deck.counts.EXTRA} extra
            </p>
          </div>
          <ScoreBadge score={deck.score.score} />
        </div>

        <ScoreBreakdown score={deck.score} />

        <Button
          className="mt-auto"
          variant={best ? 'primary' : 'secondary'}
          onClick={() => onOpen(deck.target)}
        >
          <Wand2 className="size-4" /> Voir et créer
        </Button>
      </div>
    </li>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 70
      ? 'text-success border-success/40'
      : score >= 50
        ? 'text-accent border-accent/40'
        : 'text-warning border-warning/40';
  return (
    <div
      className={cn('flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1', tone)}
      title="Note de solidité : synergie entre les cartes, moteur, staples, régularité, part de compléments génériques"
    >
      <span className="font-mono text-lg leading-none font-bold tabular-nums">{score}</span>
      <span className="text-[9px] tracking-wide uppercase">solidité</span>
    </div>
  );
}

/** Les critères de la note, en mots. */
export function ScoreBreakdown({ score }: { score: DeckScoreDto }) {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const items = [
    { label: 'Moteur', value: pct(score.engineShare), hint: 'Part du main tenue par l’archétype' },
    ...(score.synergy !== null
      ? [
          {
            label: 'Synergie',
            value: pct(score.synergy),
            hint: 'Cartes qui se cherchent / s’invoquent entre elles, starters, Extra Deck vraiment invocable',
          },
          {
            label: 'Starters',
            value: String(score.starters ?? 0),
            hint: 'Exemplaires de cartes qui lancent le jeu toutes seules',
          },
        ]
      : []),
    {
      label: 'Staples',
      value: String(score.staples),
      hint: 'Hand traps et cartes génériques du meta',
    },
    {
      label: 'Régularité',
      value: pct(score.consistency),
      hint: 'Cartes moteur jouées en 3 exemplaires',
    },
    {
      label: 'Compléments',
      value: pct(score.fillerShare),
      hint: 'Cartes génériques ajoutées pour atteindre 40',
    },
  ];
  return (
    <dl className={cn('grid gap-1 text-center', items.length > 4 ? 'grid-cols-3' : 'grid-cols-4')}>
      {items.map((i) => (
        <div key={i.label} className="rounded-lg bg-bg-sunken/60 px-1 py-1.5" title={i.hint}>
          <dt className="text-[10px] text-fg-subtle">{i.label}</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
