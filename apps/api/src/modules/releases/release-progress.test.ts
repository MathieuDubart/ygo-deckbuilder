import { describe, expect, it } from 'vitest';
import { completion, daysUntilRelease, releaseStatus, sortRarities } from './release-progress';

const today = new Date('2026-10-07T14:30:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('daysUntilRelease', () => {
  it('compte en jours entiers, quelle que soit l_heure', () => {
    expect(daysUntilRelease(day('2026-10-10'), today)).toBe(3);
    expect(daysUntilRelease(day('2026-10-07'), today)).toBe(0);
    expect(daysUntilRelease(day('2026-10-01'), today)).toBe(-6);
  });

  it('ne sait rien dire sans date', () => {
    expect(daysUntilRelease(null, today)).toBeNull();
  });
});

describe('releaseStatus', () => {
  it('annonce les sorties futures', () => {
    expect(releaseStatus(day('2026-11-20'), today)).toBe('UPCOMING');
    expect(releaseStatus(day('2026-10-08'), today)).toBe('UPCOMING');
  });

  it('garde les sorties du jour et des deux derniers mois en « récent »', () => {
    expect(releaseStatus(day('2026-10-07'), today)).toBe('RECENT');
    expect(releaseStatus(day('2026-09-01'), today)).toBe('RECENT');
  });

  it('bascule en « sorti » au-delà de la fenêtre', () => {
    // 60 jours pile : on est déjà hors fenêtre
    expect(releaseStatus(day('2026-08-08'), today)).toBe('RELEASED');
    expect(releaseStatus(day('2002-03-08'), today)).toBe('RELEASED');
  });

  it('range les extensions sans date avec les sorties, pas avec les annonces', () => {
    expect(releaseStatus(null, today)).toBe('RELEASED');
  });
});

describe('completion', () => {
  it('rend un taux entre 0 et 1', () => {
    expect(completion(0, 100)).toBe(0);
    expect(completion(25, 100)).toBe(0.25);
    expect(completion(100, 100)).toBe(1);
  });

  it('plafonne quand on possède plus d_impressions que connues', () => {
    expect(completion(12, 10)).toBe(1);
  });

  it('ne divise pas par zéro sur une extension dont la liste n_est pas révélée', () => {
    expect(completion(0, 0)).toBe(0);
  });
});

describe('sortRarities', () => {
  it('va de la plus courante à la plus rare', () => {
    const rows = [
      { rarity: 'Secret Rare', prints: 4, ownedPrints: 0 },
      { rarity: 'Common', prints: 60, ownedPrints: 12 },
      { rarity: 'Ultra Rare', prints: 8, ownedPrints: 1 },
      { rarity: 'Rare', prints: 20, ownedPrints: 3 },
    ];
    expect(sortRarities(rows).map((r) => r.rarity)).toEqual([
      'Common',
      'Rare',
      'Ultra Rare',
      'Secret Rare',
    ]);
  });

  it('place les raretés inconnues après, les plus nombreuses d_abord', () => {
    const rows = [
      { rarity: 'Rareté Inédite', prints: 2 },
      { rarity: 'Common', prints: 50 },
      { rarity: 'Autre Nouveauté', prints: 9 },
    ];
    expect(sortRarities(rows).map((r) => r.rarity)).toEqual([
      'Common',
      'Autre Nouveauté',
      'Rareté Inédite',
    ]);
  });

  it('ignore la casse et les espaces du libellé', () => {
    const rows = [
      { rarity: ' ULTRA RARE ', prints: 1 },
      { rarity: 'common', prints: 1 },
    ];
    expect(sortRarities(rows).map((r) => r.rarity.trim())).toEqual(['common', 'ULTRA RARE']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const rows = [
      { rarity: 'Secret Rare', prints: 1 },
      { rarity: 'Common', prints: 9 },
    ];
    sortRarities(rows);
    expect(rows[0]!.rarity).toBe('Secret Rare');
  });
});
