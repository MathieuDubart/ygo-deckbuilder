'use client';
import { CARD_LANGUAGES, type CardLanguage } from '@ygo/shared';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

/**
 * Formats dépendants de la langue (prix, pourcentages, dates, nombres).
 * Les prix restent en euros (Cardmarket), seul l'affichage suit la langue.
 */
export function useFormat() {
  const locale = useLocale();
  return useMemo(() => {
    const eur = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
    const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    const num = new Intl.NumberFormat(locale);
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    return {
      price: (v: number | null | undefined) => (v == null ? '—' : eur.format(v)),
      percent: (v: number) => pct.format(v),
      number: (v: number) => num.format(v),
      date: (v: string | Date) => date.format(typeof v === 'string' ? new Date(v) : v),
    };
  }, [locale]);
}

/** Langue des cartes proposée par défaut : celle de l'interface (EN, FR, DE, IT, PT). */
export const cardLanguageFor = (locale: string): CardLanguage =>
  (CARD_LANGUAGES as readonly string[]).includes(locale.toUpperCase())
    ? (locale.toUpperCase() as CardLanguage)
    : 'EN';
