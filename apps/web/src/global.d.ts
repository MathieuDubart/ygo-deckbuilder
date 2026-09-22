import type { AppLocale } from '@ygo/shared';
import type { Messages } from './i18n/types';

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}
