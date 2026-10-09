import type { CardLanguage } from '@ygo/shared';
import { describe, expect, it } from 'vitest';
import { languageReport, planLanguageNormalization, type Pile } from './language-merge';

const pile = (id: string, language: CardLanguage, quantity = 1, over: Partial<Pile> = {}): Pile => ({
  id,
  cardId: 1,
  printId: 'p1',
  condition: 'NEAR_MINT',
  language,
  firstEdition: false,
  quantity,
  ...over,
});

describe('planLanguageNormalization', () => {
  it('ne touche pas à une collection déjà dans la bonne langue', () => {
    expect(planLanguageNormalization([pile('a', 'FR'), pile('b', 'FR', 1, { cardId: 2 })], 'FR'))
      .toEqual({ retag: [], merge: [], totals: {} });
  });

  it('réétiquette une pile isolée, sans rien fusionner', () => {
    const plan = planLanguageNormalization([pile('a', 'EN', 3)], 'FR');
    expect(plan.retag).toEqual(['a']);
    expect(plan.merge).toEqual([]);
  });

  it('fusionne deux piles que la normalisation rendrait identiques', () => {
    // 2 exemplaires EN + 1 FR de la même impression = 3 exemplaires FR, pas deux lignes
    const plan = planLanguageNormalization([pile('fr', 'FR', 1), pile('en', 'EN', 2)], 'FR');
    expect(plan.merge).toEqual([{ id: 'en', into: 'fr', quantity: 2 }]);
    expect(plan.totals).toEqual({ fr: 3 });
    // La pile qui reçoit est déjà dans la bonne langue : rien à réétiqueter
    expect(plan.retag).toEqual([]);
  });

  it('ne perd aucun exemplaire en fusionnant trois piles', () => {
    const piles = [pile('a', 'EN', 2), pile('b', 'DE', 3), pile('c', 'IT', 4)];
    const plan = planLanguageNormalization(piles, 'FR');
    const kept = Object.values(plan.totals).reduce((s, n) => s + n, 0);
    expect(kept).toBe(9);
    expect(plan.merge.map((m) => m.id).sort()).toEqual(['b', 'c']);
  });

  it('garde séparé ce qui diffère par autre chose que la langue', () => {
    const piles = [
      pile('a', 'EN'),
      pile('b', 'FR', 1, { condition: 'PLAYED' }),
      pile('c', 'FR', 1, { firstEdition: true }),
      pile('d', 'FR', 1, { printId: 'p2' }),
      pile('e', 'FR', 1, { printId: null }),
    ];
    const plan = planLanguageNormalization(piles, 'FR');
    // Seule 'a' change de langue, et elle ne rejoint personne
    expect(plan.retag).toEqual(['a']);
    expect(plan.merge).toEqual([]);
  });

  it('choisit la plus ancienne quand aucune pile n’est déjà dans la langue cible', () => {
    const plan = planLanguageNormalization([pile('z', 'EN', 1), pile('a', 'DE', 1)], 'FR');
    expect(plan.merge).toEqual([{ id: 'z', into: 'a', quantity: 1 }]);
    expect(plan.retag).toEqual(['a']);
    expect(plan.totals).toEqual({ a: 2 });
  });

  it('est stable : rejouer le plan sur le résultat ne propose plus rien', () => {
    const piles = [pile('fr', 'FR', 1), pile('en', 'EN', 2), pile('de', 'DE', 3)];
    const plan = planLanguageNormalization(piles, 'FR');
    const merged = new Set(plan.merge.map((m) => m.id));
    const after = piles
      .filter((p) => !merged.has(p.id))
      .map((p) => ({ ...p, language: 'FR' as CardLanguage, quantity: plan.totals[p.id] ?? p.quantity }));
    expect(after.reduce((s, p) => s + p.quantity, 0)).toBe(6);
    expect(planLanguageNormalization(after, 'FR')).toEqual({ retag: [], merge: [], totals: {} });
  });
});

describe('languageReport', () => {
  it('compte les piles et les exemplaires par langue, les plus nombreux d’abord', () => {
    const report = languageReport(
      [pile('a', 'EN', 5), pile('b', 'EN', 1, { cardId: 2 }), pile('c', 'FR', 2, { cardId: 3 })],
      'FR',
    );
    expect(report.byLanguage).toEqual([
      { language: 'EN', piles: 2, copies: 6 },
      { language: 'FR', piles: 1, copies: 2 },
    ]);
    expect(report.affected).toBe(2);
    expect(report.merged).toBe(0);
  });

  it('annonce les fusions avant qu’elles arrivent', () => {
    const report = languageReport([pile('fr', 'FR', 1), pile('en', 'EN', 2)], 'FR');
    expect(report.affected).toBe(1);
    expect(report.merged).toBe(1);
  });
});
