import { describe, expect, it } from 'vitest';
import { normalize, normalizeProductQuery, tokens } from './normalize';

describe('normalize', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(normalize("Épée-Magique : l'Élu « Œuvre »")).toBe('epee magique l elu oeuvre');
    expect(normalize('Dragon Blanc aux Yeux Bleus')).toBe('dragon blanc aux yeux bleus');
  });

  it('découpe en mots', () => {
    expect(tokens(normalize('  yeux   bleus '))).toEqual(['yeux', 'bleus']);
  });
});

describe('normalizeProductQuery', () => {
  it('traduit les termes produit FR', () => {
    expect(normalizeProductQuery('Deck de Structure Dragon')).toBe('structure deck dragon');
    expect(normalizeProductQuery('boîte métal 2020')).toBe('tin 2020');
    expect(normalizeProductQuery('Méga Boîte 2016')).toBe('mega tin 2016');
    expect(normalizeProductQuery('tins pharaon')).toBe('tin pharaon');
    expect(normalizeProductQuery('Duellistes Légendaires')).toBe('legendary duelists');
  });

  it('laisse les noms anglais intacts', () => {
    expect(normalizeProductQuery('Structure Deck: Albaz Strike')).toBe(
      'structure deck albaz strike',
    );
  });
});
