import { describe, expect, it } from 'vitest';
import { parseSetList, setListTitles } from './set-list.parser';

// Extrait réel de « Set Card Lists:Saga of Blue-Eyes White Dragon Structure Deck (TCG-EN) »
const SDBE = `{{Set page header}}

{{Set list|region=EN|rarities=C|qty=1|print=Reprint|
SDBE-EN001; Blue-Eyes White Dragon; UR
SDBE-EN002; Rabidragon
SDBE-EN006; Maiden with Eyes of Blue; SR; New
SDBE-EN007; Rider of the Storm Winds;; New
SDBE-EN018; Shining Angel; C;; 2
SDBE-EN040; Azure-Eyes Silver Dragon; UR; New
}}`;

// Extrait réel de « Legendary Duelists: Season 3 » (blocs de variantes)
const LDS3 = `{{Set page header}}
== Variant cards ==
{{Set list|region=EN|rarities=ScR|print=Reprint|
LDS3-EN009; Curse Necrofear
LDS3-EN135; Mystical Elf - White Lightning;; New
}}
== Cards ==
{{Set list|region=EN|rarities=UR|qty=3|
LDS3-EN009; Curse Necrofear // variante couleur
LDS3-EN010; Dark Magician Girl; C
}}`;

describe('listes de cartes Yugipedia', () => {
  it('lit codes, noms et quantités (défaut d’en-tête + colonne 5)', () => {
    const rows = parseSetList(SDBE);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ code: 'SDBE-EN001', name: 'Blue-Eyes White Dragon', quantity: 1 });
    expect(rows.find((r) => r.code === 'SDBE-EN018')?.quantity).toBe(2);
    expect(rows.find((r) => r.code === 'SDBE-EN007')?.name).toBe('Rider of the Storm Winds');
  });

  it('plusieurs blocs : garde la quantité max par code, ignore les commentaires', () => {
    const rows = parseSetList(LDS3);
    expect(rows.find((r) => r.code === 'LDS3-EN009')?.quantity).toBe(3);
    expect(rows.find((r) => r.code === 'LDS3-EN010')?.name).toBe('Dark Magician Girl');
    expect(rows).toHaveLength(3);
  });

  it('titres candidats', () => {
    expect(setListTitles('Saga of Blue-Eyes White Dragon Structure Deck')[0]).toBe(
      'Set Card Lists:Saga of Blue-Eyes White Dragon Structure Deck (TCG-EN)',
    );
  });
});
