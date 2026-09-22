import { describe, expect, it } from 'vitest';
import { pickLocale } from './locales';

describe('pickLocale', () => {
  it('cookie explicite d’abord', () => expect(pickLocale('de', 'fr-FR')).toBe('de'));
  it('Accept-Language ensuite, par préférence', () => {
    expect(pickLocale(null, 'es-ES,es;q=0.9,it;q=0.8,fr;q=0.5')).toBe('it');
    expect(pickLocale(undefined, 'pt-BR')).toBe('pt');
  });
  it('anglais par défaut', () => {
    expect(pickLocale('xx', 'ja-JP')).toBe('en');
    expect(pickLocale(null, null)).toBe('en');
  });
});
