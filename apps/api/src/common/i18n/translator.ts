import type { AppLocale } from '@ygo/shared';

/**
 * Traduction côté API (textes générés : guides, notes, erreurs, descriptions d'effets).
 * Pur et sans dépendance : utilisable dans les moteurs (fonctions pures) comme dans Nest.
 *
 * Messages : arbre de chaînes ; `{param}` est remplacé ; une feuille { one, other } est un
 * pluriel choisi avec Intl.PluralRules selon `count`.
 */
export type Plural = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};
export type MessageTree = { [key: string]: string | Plural | MessageTree };

export type Params = Record<string, string | number>;

export interface Translator {
  locale: AppLocale;
  t(key: string, params?: Params): string;
  /** « A, B et C (+2) » dans la langue */
  list(items: string[], max?: number): string;
  /** Nom de carte / archétype cité dans une phrase : « X » (fr), "X" (en)… */
  quote(text: string): string;
  percent(x: number): string;
}

const isPlural = (v: unknown): v is Plural =>
  typeof v === 'object' && v !== null && 'other' in v && typeof (v as Plural).other === 'string';

function lookup(tree: MessageTree, key: string): string | Plural | undefined {
  let node: unknown = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as MessageTree)[part];
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined;
}

export function createTranslator(
  locale: AppLocale,
  messages: MessageTree,
  fallback: MessageTree,
): Translator {
  const plurals = new Intl.PluralRules(locale);
  const listFormat = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });

  const t = (key: string, params: Params = {}): string => {
    const raw = lookup(messages, key) ?? lookup(fallback, key) ?? key;
    const text = isPlural(raw)
      ? (raw[plurals.select(Number(params.count ?? 0)) as keyof Plural] ?? raw.other)
      : raw;
    return text.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
  };

  return {
    locale,
    t,
    list(items, max = 4) {
      const shown = items.slice(0, max);
      const more = items.length - shown.length;
      const body = listFormat.format(shown);
      return more > 0 ? `${body} (+${more})` : body;
    },
    quote: (text) => t('format.quote', { text }),
    percent: (x) => pct.format(x),
  };
}
