import {
  ArrowUp,
  BookOpen,
  Clock,
  Combine,
  Flame,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link as LinkIcon,
  ListOrdered,
  Scale,
  Sparkles,
  Swords,
  Wand,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/feedback';

interface RuleSection {
  id: string;
  title: string;
  icon: string;
  paragraphs: string[];
  points: string[];
  example?: string | null;
}

const ICONS: Record<string, LucideIcon> = {
  ArrowUp,
  BookOpen,
  Clock,
  Combine,
  Flame,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link: LinkIcon,
  ListOrdered,
  Scale,
  Sparkles,
  Swords,
  Wand,
  Zap,
};

/**
 * Rappel des règles officielles (Master Rule actuelle) : préparation, tour, toutes les
 * Invocations, Chaînes et combat. Contenu statique par langue (messages/<locale>/rules.json).
 */
export async function RulesView() {
  const t = await getTranslations('rules');
  const sections = t.raw('sections') as RuleSection[];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/duel"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:brightness-110"
          >
            <Swords className="size-4" /> {t('labels.openDuel')}
          </Link>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t('tocLabel')} className="hidden lg:block">
          <div className="sticky top-10 space-y-1">
            <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
              {t('tocLabel')}
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-bg-elevated hover:text-fg"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* Sommaire compact sur mobile */}
          <nav aria-label={t('tocLabel')} className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg"
              >
                {s.title}
              </a>
            ))}
          </nav>

          {sections.map((s) => {
            const Icon = ICONS[s.icon] ?? BookOpen;
            return (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-6 rounded-2xl border border-border bg-bg-elevated p-5 md:p-6"
              >
                <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Icon className="size-5" />
                  </span>
                  {s.title}
                </h2>
                <div className="space-y-3 text-sm leading-relaxed text-fg-muted">
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {s.points.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
                      {t('labels.points')}
                    </p>
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
                    <p className="mb-1 text-xs font-semibold tracking-wide text-spell uppercase">
                      {t('labels.example')}
                    </p>
                    {s.example}
                  </div>
                )}
              </section>
            );
          })}

          <p className="text-xs leading-relaxed text-fg-subtle">{t('source')}</p>
        </div>
      </div>
    </>
  );
}
