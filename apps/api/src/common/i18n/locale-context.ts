import { AsyncLocalStorage } from 'node:async_hooks';
import { DEFAULT_LOCALE, LOCALE_COOKIE, pickLocale, type AppLocale } from '@ygo/shared';
import type { NextFunction, Request, Response } from 'express';
import { MESSAGES } from './messages';
import { createTranslator, type Params, type Translator } from './translator';

/**
 * Langue de la requête en cours, sans la faire passer de fonction en fonction :
 * cookie choisi dans l'app (relayé par le proxy /api), sinon Accept-Language, sinon anglais.
 */
const storage = new AsyncLocalStorage<AppLocale>();

export function localeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  storage.run(pickLocale(cookies?.[LOCALE_COOKIE], req.headers['accept-language']), next);
}

export const currentLocale = (): AppLocale => storage.getStore() ?? DEFAULT_LOCALE;

const cache = new Map<AppLocale, Translator>();
/** Traducteur pour une langue (par défaut : celle de la requête). */
export function translator(locale: AppLocale = currentLocale()): Translator {
  let tr = cache.get(locale);
  if (!tr) {
    tr = createTranslator(locale, MESSAGES[locale], MESSAGES.en);
    cache.set(locale, tr);
  }
  return tr;
}

/** Raccourci : texte dans la langue de la requête. */
export const t = (key: string, params?: Params) => translator().t(key, params);
