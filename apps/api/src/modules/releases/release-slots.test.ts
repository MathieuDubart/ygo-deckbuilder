import { describe, expect, it } from 'vitest';
import { coverSlots, filledSlots, type Slot } from './release-slots';

const slot = (printCode: string, owned = 0): Slot => ({ printCode, owned });

/** Raccourci de lecture : le code des cases cochées, dans l'ordre d'entrée. */
const ticked = (slots: Slot[], copies: number) =>
  coverSlots(slots, copies)
    .filter((s) => s.owned > 0 || s.covered > 0)
    .map((s) => s.printCode);

describe('coverSlots', () => {
  it('coche les trois numéros du structure deck avec trois exemplaires', () => {
    // Le cas qui a motivé la règle : trois Dragon Blanc aux numéros 001, 002 et 003, rangés
    // par la collection sur une seule impression puisque c'est la même carte.
    const slots = [slot('SDWD-EN001', 3), slot('SDWD-EN002'), slot('SDWD-EN003')];
    expect(ticked(slots, 3)).toEqual(['SDWD-EN001', 'SDWD-EN002', 'SDWD-EN003']);
  });

  it('n’en coche que deux avec deux exemplaires', () => {
    const slots = [slot('SDWD-EN001', 2), slot('SDWD-EN002'), slot('SDWD-EN003')];
    expect(ticked(slots, 2)).toEqual(['SDWD-EN001', 'SDWD-EN002']);
  });

  it('coche le numéro possédé dans une autre rareté', () => {
    // Deux lignes, une seule case : la case porte un code, pas une rareté.
    expect(coverSlots([slot('LOB-EN001')], 1)).toEqual([
      { printCode: 'LOB-EN001', owned: 0, covered: 1 },
    ]);
  });

  it('ne coche rien sans exemplaire', () => {
    expect(ticked([slot('A-001'), slot('A-002')], 0)).toEqual([]);
  });

  it('sert d’abord les cases qui ont leur propre exemplaire', () => {
    // Le reliquat va sur 001, pas sur 003 qui est déjà pourvue.
    const got = coverSlots([slot('A-001'), slot('A-002'), slot('A-003', 1)], 2);
    expect(got.map((s) => [s.printCode, s.covered])).toEqual([
      ['A-001', 1],
      ['A-002', 0],
      ['A-003', 0],
    ]);
  });

  it('ne compte pas deux fois un exemplaire posé sur une case', () => {
    // Un seul exemplaire, posé sur 002 : il coche sa case et rien d'autre.
    expect(ticked([slot('A-001'), slot('A-002', 1)], 1)).toEqual(['A-002']);
  });

  it('ne déborde pas quand on en a plus que de cases', () => {
    const got = coverSlots([slot('A-001', 9)], 9);
    expect(got).toEqual([{ printCode: 'A-001', owned: 9, covered: 0 }]);
  });

  it('rend la même réponse quel que soit l’ordre reçu', () => {
    const slots = [slot('A-003'), slot('A-001'), slot('A-002')];
    const a = ticked(slots, 2).sort();
    const b = ticked([...slots].reverse(), 2).sort();
    expect(a).toEqual(b);
    expect(a).toEqual(['A-001', 'A-002']);
  });

  it('garde l’ordre d’affichage reçu', () => {
    const got = coverSlots([slot('A-003'), slot('A-001')], 2);
    expect(got.map((s) => s.printCode)).toEqual(['A-003', 'A-001']);
  });

  it('ne touche pas à la liste reçue', () => {
    const slots = [slot('A-002'), slot('A-001')];
    coverSlots(slots, 1);
    expect(slots.map((s) => s.printCode)).toEqual(['A-002', 'A-001']);
  });
});

describe('filledSlots', () => {
  it('reproduit le compte de coverSlots', () => {
    const cases: [Slot[], number][] = [
      [[slot('A-001', 3), slot('A-002'), slot('A-003')], 3],
      [[slot('A-001', 2), slot('A-002'), slot('A-003')], 2],
      [[slot('A-001'), slot('A-002')], 0],
      [[slot('A-001', 9)], 9],
    ];
    for (const [slots, copies] of cases) {
      expect(filledSlots(slots.length, copies)).toBe(ticked(slots, copies).length);
    }
  });

  it('ne rend jamais de négatif', () => {
    expect(filledSlots(0, 5)).toBe(0);
    expect(filledSlots(3, -1)).toBe(0);
  });
});
