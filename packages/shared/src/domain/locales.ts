/**
 * Langues de l'application (interface + textes générés par l'API + noms/effets des cartes).
 * L'anglais est la langue de référence : c'est aussi la langue officielle des textes de cartes.
 */
export const APP_LOCALES = ['en', 'fr', 'de', 'it', 'pt'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';

/** Cookie partagé front / API (même origine grâce au proxy /api). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Langues dont YGOPRODeck fournit les noms / effets de cartes, en plus de l'anglais. */
export const CARD_TEXT_LOCALES = ['fr', 'de', 'it', 'pt'] as const satisfies readonly AppLocale[];

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
};

export const isAppLocale = (v: unknown): v is AppLocale =>
  typeof v === 'string' && (APP_LOCALES as readonly string[]).includes(v);

/**
 * Choisit la langue : cookie explicite, sinon en-tête Accept-Language du navigateur
 * ("fr-FR,fr;q=0.9,en;q=0.8"), sinon l'anglais.
 */
export function pickLocale(cookie?: string | null, acceptLanguage?: string | null): AppLocale {
  if (isAppLocale(cookie)) return cookie;
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0] ?? '', q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return (wanted.find((w) => isAppLocale(w.lang))?.lang as AppLocale | undefined) ?? DEFAULT_LOCALE;
}
