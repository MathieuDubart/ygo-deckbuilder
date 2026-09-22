'use client';
import type {
  CardSummaryDto,
  DeckGuideDto,
  GuideComboDto,
  GuideRole,
  GuideStatDto,
} from '@ygo/shared';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  ChevronDown,
  Lightbulb,
  Loader2,
  RotateCw,
  Route,
  Sparkles,
  Star,
  Swords,
  Workflow,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { useDeckGuide, type GuideCard } from '@/lib/api/guide';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<GuideRole, string> = {
  STARTER: 'Starter',
  SEARCHER: 'Chercheur',
  EXTENDER: 'Extender',
  HAND_TRAP: 'Hand trap',
  INTERRUPTION: 'Interruption',
  REMOVAL: 'Destruction',
  DRAW: 'Pioche',
  RECOVERY: 'Récupération',
  FUSION_ENABLER: 'Fusion',
  RITUAL_ENABLER: 'Rituel',
  BOSS: 'Boss',
};

const ROLE_TONE: Partial<Record<GuideRole, 'accent' | 'success' | 'warning' | 'danger'>> = {
  STARTER: 'success',
  BOSS: 'accent',
  HAND_TRAP: 'warning',
  INTERRUPTION: 'warning',
  REMOVAL: 'danger',
};

/**
 * Guide de jeu d'une liste : comment le deck gagne, ses cartes clés, des combos pas à pas,
 * quoi faire en premier / en second et les erreurs à éviter. Calculé à partir des effets
 * des cartes ; une IA peut le rédiger si le serveur en a une.
 */
export function DeckGuide({
  cards,
  name,
  onInspect,
  className,
}: {
  cards: GuideCard[];
  name?: string;
  onInspect?: (cardId: number) => void;
  className?: string;
}) {
  // Guide calculé (instantané) ; version IA à la demande, via le switch (mémorisé)
  const [mode, setModeState] = useState<GuideMode>('RULES');
  // Lu après le montage : pas d'écart entre rendu serveur et client
  useEffect(() => setModeState(readMode()), []);
  const setMode = (m: GuideMode) => {
    setModeState(m);
    saveMode(m);
  };
  const rules = useDeckGuide(cards, { name, ai: false });
  const aiAvailable = !!rules.data?.aiAvailable;
  const wantAi = aiAvailable && mode === 'AI';
  const ai = useDeckGuide(cards, { name, ai: true, enabled: wantAi });

  const aiGuide = !ai.isPlaceholderData && ai.data?.source === 'AI' ? ai.data : null;
  const aiError =
    wantAi && !ai.isPlaceholderData ? (ai.error?.message ?? ai.data?.aiError ?? null) : null;
  // En cours : 1re requête, ou rédaction en arrière-plan côté API (on repasse toutes les 3 s)
  const writing =
    wantAi &&
    !aiGuide &&
    (ai.isPlaceholderData || ai.data?.aiStatus === 'PENDING' || (ai.isFetching && !ai.data));
  const guide = wantAi && aiGuide ? aiGuide : rules.data;

  return (
    <section className={cn('space-y-4', className)} aria-labelledby="deck-guide-title">
      <header className="flex flex-wrap items-center gap-2">
        <h3 id="deck-guide-title" className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4 text-accent" /> Guide du deck
        </h3>
        {guide && (
          <Badge tone={guide.source === 'AI' ? 'accent' : 'neutral'}>
            {guide.source === 'AI'
              ? `Rédigé par IA${guide.model ? ` · ${guide.model}` : ''}`
              : 'Calculé à partir des effets'}
          </Badge>
        )}
        {aiAvailable && <ModeSwitch mode={mode} onChange={setMode} writing={writing} />}
      </header>

      {writing && (
        <p className="flex items-center gap-1.5 text-xs text-fg-muted" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" /> L’IA rédige le guide… (un modèle local peut
          prendre une minute ou deux) — version calculée en attendant.
        </p>
      )}

      {aiError && !writing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{aiError} — guide calculé affiché à la place.</span>
          <Button size="sm" variant="ghost" onClick={() => ai.refetch()}>
            <RotateCw className="size-3.5" /> Réessayer
          </Button>
        </div>
      )}

      {rules.error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {rules.error.message}
        </p>
      ) : !guide ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <GuideBody
          guide={guide}
          onInspect={onInspect}
          dimmed={guide.source === 'RULES' && rules.isFetching}
        />
      )}
    </section>
  );
}

type GuideMode = 'RULES' | 'AI';
const MODE_KEY = 'ygo.guide-mode';

/** Préférence du navigateur (facultative : localStorage peut être indisponible). */
function readMode(): GuideMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'AI' ? 'AI' : 'RULES';
  } catch {
    return 'RULES';
  }
}
function saveMode(m: GuideMode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    // navigation privée, stockage bloqué : tant pis, le choix vaut pour la session
  }
}

function ModeSwitch({
  mode,
  onChange,
  writing,
}: {
  mode: GuideMode;
  onChange: (m: GuideMode) => void;
  writing: boolean;
}) {
  const options: { value: GuideMode; label: string; icon: typeof BookOpen }[] = [
    { value: 'RULES', label: 'Calculé', icon: Calculator },
    { value: 'AI', label: 'Rédigé par IA', icon: Sparkles },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Version du guide"
      className="ml-auto grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-xs"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition',
            mode === value ? 'bg-bg-elevated text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
          )}
        >
          {value === 'AI' && writing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Icon className="size-3.5" />
          )}
          {label}
        </button>
      ))}
    </div>
  );
}

function GuideBody({
  guide,
  onInspect,
  dimmed,
}: {
  guide: DeckGuideDto;
  onInspect?: (cardId: number) => void;
  dimmed: boolean;
}) {
  const card = (id: number) => guide.cards[String(id)];
  return (
    <div className={cn('space-y-4 transition', dimmed && 'opacity-60')}>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {guide.styles.map((s) => (
            <Badge key={s} tone="accent">
              {s}
            </Badge>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">{guide.summary}</p>
      </div>

      {guide.stats.length > 0 && (
        <dl className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {guide.stats.map((s) => (
            <StatChip key={s.label} stat={s} />
          ))}
        </dl>
      )}

      {guide.gamePlan.length > 0 && (
        <Section icon={Route} title="Plan de jeu" defaultOpen>
          <Bullets items={guide.gamePlan} />
        </Section>
      )}

      {guide.combos.length > 0 && (
        <Section icon={Workflow} title={`Combos à connaître (${guide.combos.length})`} defaultOpen>
          <div className="space-y-3">
            {guide.combos.map((c, i) => (
              <Combo key={i} combo={c} card={card} onInspect={onInspect} />
            ))}
            <p className="text-xs text-fg-subtle">
              Lignes indicatives trouvées en lisant les effets : vérifie toujours le texte exact des
              cartes (conditions, coûts, « 1 fois par tour »).
            </p>
          </div>
        </Section>
      )}

      {guide.keyCards.length > 0 && (
        <Section icon={Star} title="Cartes clés">
          <ul className="grid gap-2 sm:grid-cols-2">
            {guide.keyCards.map((k) => {
              const c = card(k.cardId);
              if (!c) return null;
              return (
                <li key={k.cardId} className="flex gap-2.5 rounded-lg bg-bg-sunken/60 p-2">
                  <CardThumb card={c} onInspect={onInspect} className="w-11" />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium" title={c.name}>
                      {c.name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {k.roles.slice(0, 3).map((r) => (
                        <Badge key={r} tone={ROLE_TONE[r] ?? 'neutral'} className="text-[10px]">
                          {ROLE_LABEL[r]}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs leading-snug text-fg-muted">{k.why}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {guide.goingFirst.length + guide.goingSecond.length > 0 && (
        <Section icon={Swords} title="En premier / en second">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                Tu commences
              </p>
              <Bullets items={guide.goingFirst} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                Tu joues second
              </p>
              <Bullets items={guide.goingSecond} />
            </div>
          </div>
        </Section>
      )}

      <Section icon={AlertTriangle} title="Erreurs à éviter" defaultOpen tone="warning">
        <Bullets items={guide.mistakes} />
      </Section>

      {guide.tips.length > 0 && (
        <Section icon={Lightbulb} title="Astuces">
          <Bullets items={guide.tips} />
        </Section>
      )}
    </div>
  );
}

function StatChip({ stat }: { stat: GuideStatDto }) {
  return (
    <div className="rounded-lg bg-bg-sunken/60 px-1 py-1.5 text-center" title={stat.hint}>
      <dt className="truncate text-[10px] text-fg-subtle">{stat.label}</dt>
      <dd
        className={cn(
          'font-mono text-sm font-semibold tabular-nums',
          stat.tone === 'good' && 'text-success',
          stat.tone === 'warn' && 'text-warning',
          stat.tone === 'bad' && 'text-danger',
        )}
      >
        {stat.value}
      </dd>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  defaultOpen,
  tone,
  children,
}: {
  icon: typeof Route;
  title: string;
  defaultOpen?: boolean;
  tone?: 'warning';
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group rounded-xl border border-border',
        tone === 'warning' && 'border-warning/30 bg-warning/5',
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
        <Icon className={cn('size-4', tone === 'warning' ? 'text-warning' : 'text-fg-muted')} />
        {title}
        <ChevronDown className="ml-auto size-4 text-fg-subtle transition group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-fg-subtle">Rien de particulier.</p>;
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-fg-muted">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Combo({
  combo,
  card,
  onInspect,
}: {
  combo: GuideComboDto;
  card: (id: number) => CardSummaryDto | undefined;
  onInspect?: (cardId: number) => void;
}) {
  const hand = combo.handIds.map(card).filter(Boolean) as CardSummaryDto[];
  const board = combo.endBoardIds.map(card).filter(Boolean) as CardSummaryDto[];
  return (
    <div className="rounded-lg bg-bg-sunken/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex -space-x-3">
          {hand.map((c) => (
            <CardThumb
              key={c.id}
              card={c}
              onInspect={onInspect}
              className="w-9 ring-2 ring-bg-elevated"
            />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-fg-subtle uppercase">En main</p>
          <p className="truncate text-sm font-medium">{combo.title}</p>
        </div>
      </div>
      <ol className="space-y-1 text-sm">
        {combo.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-elevated font-mono text-[10px] text-fg-muted tabular-nums">
              {i + 1}
            </span>
            <span className="text-fg-muted">{s.text}</span>
          </li>
        ))}
      </ol>
      {board.length > 0 && (
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <p className="text-[11px] tracking-wide text-fg-subtle uppercase">Terrain final</p>
          <div className="flex gap-1">
            {board.map((c, i) => (
              <CardThumb key={`${c.id}-${i}`} card={c} onInspect={onInspect} className="w-8" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardThumb({
  card,
  onInspect,
  className,
}: {
  card: CardSummaryDto;
  onInspect?: (cardId: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onInspect?.(card.id)}
      disabled={!onInspect}
      title={card.name}
      className={cn(
        'shrink-0 rounded-[4%/3%] transition enabled:hover:-translate-y-0.5',
        className,
      )}
    >
      <CardImage card={card} sizes="48px" />
    </button>
  );
}
