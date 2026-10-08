'use client';
import {
  ArrowUp,
  BookOpen,
  Clock,
  Combine,
  ExternalLink,
  Flame,
  Hash,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link as LinkIcon,
  ListOrdered,
  Scale,
  Search,
  Shapes,
  Sparkles,
  Swords,
  Trophy,
  Wand,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { RuleCards } from './rule-cards';
import { RuleDiagram, type DiagramLabels } from './rule-diagram';
import { RuleVideo, type RuleVideo as RuleVideoData } from './rule-video';

export interface RuleSection {
  id: string;
  group: string;
  title: string;
  icon: string;
  summary: string;
  diagram?: string;
  cards?: string[];
  video?: RuleVideoData;
  paragraphs: string[];
  points: string[];
  example?: string | null;
}
export interface GlossaryEntry {
  term: string;
  definition: string;
}
export interface RuleLink {
  label: string;
  description: string;
  url: string;
}
export interface RulesLabels {
  points: string;
  example: string;
  exampleCards: string;
  glossary: string;
  glossaryHint: string;
  links: string;
  linksHint: string;
  search: string;
  noResults: string;
  video: string;
  videoOpen: string;
  clear: string;
  toc: string;
  source: string;
}

const ICONS: Record<string, LucideIcon> = {
  ArrowUp,
  BookOpen,
  Clock,
  Combine,
  Flame,
  Hash,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link: LinkIcon,
  ListOrdered,
  Scale,
  Shapes,
  Sparkles,
  Swords,
  Trophy,
  Wand,
  Zap,
};

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Tout le texte d'une section, pour la recherche */
const haystack = (s: RuleSection) =>
  fold([s.title, s.summary, ...s.paragraphs, ...s.points, s.example ?? ''].join(' '));

export function RulesBrowser({
  sections,
  groups,
  glossary,
  links,
  labels,
  diagrams,
}: {
  sections: RuleSection[];
  groups: Record<string, string>;
  glossary: GlossaryEntry[];
  links: RuleLink[];
  labels: RulesLabels;
  diagrams: DiagramLabels;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [inspect, setInspect] = useState<number | null>(null);
  const spy = useRef<Map<string, number>>(new Map());

  const needle = fold(query.trim());
  const index = useMemo(() => sections.map((s) => ({ section: s, text: haystack(s) })), [sections]);
  const visible = useMemo(
    () => (needle ? index.filter((e) => e.text.includes(needle)) : index).map((e) => e.section),
    [index, needle],
  );
  const terms = useMemo(
    () =>
      needle
        ? glossary.filter((g) => fold(`${g.term} ${g.definition}`).includes(needle))
        : glossary,
    [glossary, needle],
  );

  // Sommaire : la section la plus haute visible à l'écran
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = spy.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id;
          if (e.isIntersecting) seen.set(id, e.boundingClientRect.top);
          else seen.delete(id);
        }
        const top = [...seen.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    for (const s of visible) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => {
      io.disconnect();
      seen.clear();
    };
  }, [visible]);

  const byGroup = Object.keys(groups)
    .map((key) => ({ key, label: groups[key], items: visible.filter((s) => s.group === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={labels.toc} className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] space-y-4 overflow-y-auto pb-6">
            {byGroup.map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 text-xs font-medium text-fg-subtle">{g.label}</p>
                <ul className="space-y-0.5 border-l border-border">
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        aria-current={active === s.id ? 'true' : undefined}
                        className={cn(
                          '-ml-px block border-l-2 py-1 pl-2.5 text-sm transition',
                          active === s.id
                            ? 'border-accent font-medium text-fg'
                            : 'border-transparent text-fg-muted hover:border-border-strong hover:text-fg',
                        )}
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <a href="#glossary" className="block pl-2.5 text-sm text-fg-muted hover:text-fg">
              {labels.glossary}
            </a>
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
              className="pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={labels.clear}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-ink/5 hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Sommaire compact sur mobile */}
          <nav aria-label={labels.toc} className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {visible.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg"
              >
                {s.title}
              </a>
            ))}
          </nav>

          {visible.length === 0 && terms.length === 0 && (
            <p className="rounded-2xl border border-border bg-bg-elevated p-6 text-sm text-fg-muted">
              {labels.noResults}
            </p>
          )}

          {visible.map((s) => {
            const Icon = ICONS[s.icon] ?? BookOpen;
            return (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-6 rounded-2xl border border-border bg-bg-elevated p-5 md:p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg leading-tight font-semibold">{s.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-accent">{s.summary}</p>
                  </div>
                </div>

                {s.diagram && <RuleDiagram id={s.diagram} labels={diagrams} />}

                <div className="mt-5 space-y-3 text-sm leading-relaxed text-fg-muted">
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>

                {s.points.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-medium text-fg-subtle">{labels.points}</p>
                    <ul className="space-y-2 text-sm leading-relaxed">
                      {s.points.map((p, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.example && (
                  <div className="mt-5 rounded-xl border border-spell/30 bg-spell/10 px-4 py-3 text-sm leading-relaxed">
                    <p className="mb-1 text-xs font-semibold text-spell">{labels.example}</p>
                    {s.example}
                  </div>
                )}

                {s.cards && s.cards.length > 0 && (
                  <RuleCards names={s.cards} label={labels.exampleCards} onOpen={setInspect} />
                )}

                {s.video && (
                  <RuleVideo
                    video={s.video}
                    labels={{ video: labels.video, open: labels.videoOpen }}
                  />
                )}
              </section>
            );
          })}

          {terms.length > 0 && (
            <section
              id="glossary"
              className="scroll-mt-6 rounded-2xl border border-border bg-bg-elevated p-5 md:p-6"
            >
              <h2 className="text-lg font-semibold">{labels.glossary}</h2>
              <p className="mt-1 text-sm text-fg-muted">{labels.glossaryHint}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {terms.map((g) => (
                  <div key={g.term} className="text-sm leading-relaxed">
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-fg-muted">{g.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-bg-elevated p-5 md:p-6">
            <h2 className="text-lg font-semibold">{labels.links}</h2>
            <p className="mt-1 text-sm text-fg-muted">{labels.linksHint}</p>
            <ul className="mt-4 space-y-2">
              {links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-accent/60 hover:bg-bg-sunken/60"
                  >
                    <ExternalLink className="mt-0.5 size-4 shrink-0 text-fg-subtle group-hover:text-accent" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{l.label}</span>
                      <span className="block text-sm text-fg-muted">{l.description}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs leading-relaxed text-fg-subtle">{labels.source}</p>
        </div>
      </div>
      <CardDetailDialog cardId={inspect} onClose={() => setInspect(null)} />
    </>
  );
}
