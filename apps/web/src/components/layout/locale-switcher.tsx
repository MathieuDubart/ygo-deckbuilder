'use client';
import { useQueryClient } from '@tanstack/react-query';
import { APP_LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type AppLocale } from '@ygo/shared';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

/**
 * Choix de la langue : mémorisé dans un cookie lu par le front (textes) ET par l'API
 * (noms de cartes, guides, messages d'erreur). On recharge ensuite les données.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('common.locale');
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, startTransition] = useTransition();

  function change(next: AppLocale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      router.refresh();
      void qc.invalidateQueries();
    });
  }

  return (
    <label className={cn('relative flex items-center text-fg-subtle', className)}>
      <Languages className="pointer-events-none absolute left-2 size-3.5" aria-hidden />
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value as AppLocale)}
        className="appearance-none rounded-md border border-border bg-bg-sunken py-1 pr-2 pl-7 text-xs text-fg-muted hover:text-fg focus:outline-none disabled:opacity-50"
      >
        {APP_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
