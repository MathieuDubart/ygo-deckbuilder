'use client';
import type { DeckStrengthDto, MatchupDto, MatchupVerdict } from '@ygo/shared';
import { Minus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge, ScoreBreakdown } from '@/components/ui/deck-score';
import { cn } from '@/lib/utils';

/**
 * Contre quoi un deck tient, et contre quoi il souffre.
 *
 * L'ordre est celui du serveur, du plus favorable au moins favorable : on lit d'abord ce
 * qu'on sait battre. Chaque ligne porte sa raison, parce qu'un verdict sans cause ne se
 * corrige pas — « défavorable » n'apprend rien, « trop peu de cartes de main » se joue.
 */

const VERDICT: Record<MatchupVerdict, { icon: typeof ThumbsUp; tone: string }> = {
  GOOD: { icon: ThumbsUp, tone: 'text-success' },
  EVEN: { icon: Minus, tone: 'text-fg-subtle' },
  BAD: { icon: ThumbsDown, tone: 'text-warning' },
};

export function MatchupList({ matchups }: { matchups: MatchupDto[] }) {
  const t = useTranslations('decks');
  if (!matchups.length) return null;
  return (
    <ul className="space-y-1">
      {matchups.map((m) => {
        const { icon: Icon, tone } = VERDICT[m.verdict];
        return (
          <li
            key={m.opponent ?? m.against}
            className="flex items-start gap-2 rounded-lg bg-bg-sunken/60 px-2 py-1.5"
          >
            <Icon className={cn('mt-0.5 size-3.5 shrink-0', tone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">
                {/* Un nom de deck du meta quand on le connaît, une forme de jeu sinon */}
                {m.opponent ?? t('matchups.vsStyle', { style: t(`styles.${m.against}`) })}
              </p>
              <p className="text-[11px] text-fg-subtle">{t(`matchups.reasons.${m.reason}`)}</p>
            </div>
            <span className={cn('shrink-0 text-[10px] font-medium', tone)}>
              {t(`matchups.verdicts.${m.verdict}`)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** La force complète d'un deck : sa note, sa forme, ses pronostics. */
export function DeckStrengthPanel({ strength }: { strength: DeckStrengthDto | null | undefined }) {
  const t = useTranslations('decks');
  if (!strength) {
    return <p className="text-xs text-fg-subtle">{t('matchups.none')}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <ScoreBadge score={strength.score.score} />
        <div className="min-w-0 flex-1 space-y-1">
          <Badge>{t(`styles.${strength.profile.style}`)}</Badge>
          <p className="text-[11px] text-fg-subtle">
            {t(`styleHints.${strength.profile.style}`)}
          </p>
        </div>
      </div>
      <ScoreBreakdown score={strength.score} />
      <div className="space-y-1.5">
        <p className="text-xs font-medium" title={t('matchups.hint')}>
          {t('matchups.title')}
        </p>
        <MatchupList matchups={strength.matchups} />
      </div>
    </div>
  );
}
