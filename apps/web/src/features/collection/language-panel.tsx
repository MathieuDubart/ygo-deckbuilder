'use client';
import { CARD_LANGUAGES, type CardLanguage } from '@ygo/shared';
import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FacetSelect } from '@/components/ui/facet-select';
import { SectionHeading } from '@/components/ui/feedback';
import { useCollectionLanguage, useSetCollectionLanguage } from '@/lib/api/collection';
import { cn } from '@/lib/utils';

/**
 * La langue dans laquelle on range sa collection, et le moyen d'y ramener ce qui n'y est pas.
 *
 * Le panneau ne s'ouvre pas sur un bouton « normaliser » : il montre d'abord la répartition
 * réelle, parce que la question n'a de sens qu'avec les nombres sous les yeux — et parce que
 * ramener quatre cents cartes dans une langue ne se défait pas.
 */
export function LanguagePanel() {
  const t = useTranslations('collection.language');
  const [target, setTarget] = useState<CardLanguage | undefined>();
  const { data } = useCollectionLanguage(target);
  const save = useSetCollectionLanguage();

  if (!data) return null;
  const { report } = data;
  const total = report.byLanguage.reduce((sum, l) => sum + l.copies, 0);
  // Collection vide : il n'y a rien à ranger, et donc rien à demander.
  if (total === 0) return null;
  // Une seule langue : on garde le réglage accessible — c'est le seul endroit pour en
  // changer — mais la répartition n'apprendrait rien, une barre pleine ne dit rien.
  const uniform = report.byLanguage.length <= 1;

  const chosen = target ?? data.effective;
  const apply = (normalize: boolean) =>
    save.mutate(
      { language: chosen, normalize },
      {
        onSuccess: (result) =>
          toast.success(
            result.retagged || result.merged
              ? t('done', { count: result.retagged, merged: result.merged })
              : t('saved', { language: chosen }),
          ),
      },
    );

  return (
    <section className="mb-8">
      <SectionHeading
        action={
          <FacetSelect
            label={t('label')}
            allLabel={data.effective}
            value={chosen}
            options={CARD_LANGUAGES.map((value) => ({ value, label: value }))}
            onChange={(value) => setTarget((value as CardLanguage) ?? undefined)}
          />
        }
      >
        {t('title')}
      </SectionHeading>

      {!data.language && <p className="mb-2 text-xs text-ink-faint">{t('neverChosen')}</p>}

      {/* La répartition : c'est elle qui dit si la question se pose */}
      <ul className={cn('space-y-1.5', uniform && 'hidden')}>
        {report.byLanguage.map((row) => (
          <li key={row.language} className="flex items-center gap-3">
            <span
              className={cn(
                'code w-8 px-1 text-center text-[11px]',
                row.language === chosen
                  ? 'bg-label font-bold text-label-ink'
                  : 'text-ink-muted',
              )}
            >
              {row.language}
            </span>
            <span className="pocket h-1 flex-1 rounded-xs">
              <span
                className="block h-full bg-ink-muted"
                style={{ width: `${Math.round((row.copies / total) * 100)}%` }}
              />
            </span>
            <span className="code w-32 text-right text-xs text-ink-muted">
              {t('copies', { count: row.copies, piles: row.piles })}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {report.affected > 0 ? (
          <>
            <Button size="sm" loading={save.isPending} onClick={() => apply(true)}>
              <Languages className="size-4" />
              {t('normalize', { language: chosen, count: report.affected })}
            </Button>
            <p className="text-xs text-ink-muted">
              {report.merged > 0
                ? t('willMerge', { count: report.merged })
                : t('willRetag', { count: report.affected })}
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-muted">{t('alreadyUniform', { language: chosen })}</p>
        )}
        {/* Choisir la langue des PROCHAINES cartes sans toucher aux anciennes */}
        {data.language !== chosen && (
          <Button size="sm" variant="ghost" loading={save.isPending} onClick={() => apply(false)}>
            {t('onlyFuture')}
          </Button>
        )}
      </div>
    </section>
  );
}
