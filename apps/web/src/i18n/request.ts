import { LOCALE_COOKIE, pickLocale, type AppLocale } from '@ygo/shared';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { NAMESPACES } from './namespaces';

/**
 * Langue de la requête : cookie choisi via le sélecteur, sinon langue du navigateur,
 * sinon anglais. Pas de préfixe d'URL : l'app est derrière un login, pas besoin de SEO.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = pickLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get('accept-language'),
  );
  return { locale, messages: await loadMessages(locale) };
});

async function loadMessages(locale: AppLocale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const own = (await import(`../../messages/${locale}/${ns}.json`)).default;
      // Clé manquante dans une traduction → texte anglais plutôt qu'une clé brute
      const fallback =
        locale === 'en' ? {} : (await import(`../../messages/en/${ns}.json`)).default;
      return [ns, deepMerge(fallback, own)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

type Tree = { [k: string]: string | Tree };
function deepMerge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === 'object' && typeof b === 'object' ? deepMerge(b, v) : v;
  }
  return out;
}
