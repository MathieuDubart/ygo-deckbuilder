import type { AppLocale } from '@ygo/shared';
import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { it } from './it';
import { pt } from './pt';
import type { MessageTree } from '../translator';

export const MESSAGES: Record<AppLocale, MessageTree> = {
  en: en as unknown as MessageTree,
  fr: fr as MessageTree,
  de: de as MessageTree,
  it: it as MessageTree,
  pt: pt as MessageTree,
};
