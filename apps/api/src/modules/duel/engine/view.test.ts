import { OcgLocation, OcgPhase, OcgPosition } from 'ocgcore-wasm';
import { describe, expect, it } from 'vitest';
import { DuelView, fromPosition, positionsIn, toLocation, toPhase, zonesFromMask } from './view';

describe('DuelView', () => {
  it("met toujours l'utilisateur en joueur 0", () => {
    const second = new DuelView(1);
    expect(second.player(1)).toBe(0);
    expect(second.player(0)).toBe(1);
    expect(second.team(0)).toBe(1);
    expect(second.team(1)).toBe(0);
  });

  it('cache le code des cartes cachées', () => {
    const view = new DuelView(0);
    const card = { code: 89631139, controller: 1, location: OcgLocation.HAND, sequence: 2 };
    expect(view.ref(card, true)).toEqual({ controller: 1, location: 'HAND', sequence: 2, code: 0 });
    expect(view.ref(card).code).toBe(89631139);
  });
});

describe('conversions', () => {
  it('ramène Terrain et Pendule aux Zones Magie & Piège, et repère les Matériels', () => {
    expect(toLocation(OcgLocation.FZONE)).toBe('SZONE');
    expect(toLocation(OcgLocation.PZONE)).toBe('SZONE');
    expect(toLocation(OcgLocation.MZONE | OcgLocation.OVERLAY)).toBe('OVERLAY');
    expect(toLocation(OcgLocation.REMOVED)).toBe('BANISHED');
  });

  it('fait l’aller-retour des positions', () => {
    for (const p of ['ATK', 'DEF', 'FD_ATK', 'FD_DEF'] as const)
      expect(positionsIn(fromPosition(p))).toEqual([p]);
    expect(positionsIn(OcgPosition.FACEUP_ATTACK | OcgPosition.FACEDOWN_DEFENSE)).toEqual([
      'ATK',
      'FD_DEF',
    ]);
  });

  it('regroupe les étapes de la Battle Phase', () => {
    expect(toPhase(OcgPhase.DAMAGE_CAL)).toBe('BATTLE');
    expect(toPhase(OcgPhase.MAIN2)).toBe('MAIN2');
    expect(toPhase(0)).toBeNull();
  });
});

describe('zonesFromMask', () => {
  it('liste les zones libres (bit à 0) des deux côtés', () => {
    // Tout est pris sauf : Zone Monstre 2 du joueur, Zone Terrain du joueur, Zone Monstre 0 adverse
    const mask = ~((1 << 2) | (1 << (8 + 5)) | (1 << 16)) >>> 0;
    expect(zonesFromMask(mask, 1)).toEqual([
      { controller: 1, location: 'MZONE', sequence: 2 },
      { controller: 1, location: 'SZONE', sequence: 5 },
      { controller: 0, location: 'MZONE', sequence: 0 },
    ]);
  });
});
