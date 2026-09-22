import { describe, expect, it } from 'vitest';
import { translator } from './locale-context';

describe('traductions API', () => {
  it('interpole, choisit le pluriel et retombe sur l’anglais', () => {
    const fr = translator('fr');
    expect(fr.t('generator.basedOn', { count: 1 })).toBe('Basé sur 1 liste de tournoi récente.');
    expect(fr.t('generator.basedOn', { count: 3 })).toBe('Basé sur 3 listes de tournoi récentes.');
    expect(translator('en').t('errors.archetypeNotOwned', { archetype: 'HERO' })).toBe(
      'No “HERO” card in your collection',
    );
  });

  it('listes et citations selon la langue', () => {
    expect(translator('fr').list(['A', 'B', 'C'])).toBe('A, B et C');
    expect(translator('en').list(['A', 'B', 'C', 'D', 'E'], 3)).toBe('A, B, and C (+2)');
    expect(translator('fr').quote('Sage')).toBe('« Sage »');
  });
});
