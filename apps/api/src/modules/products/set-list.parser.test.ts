import { describe, expect, it } from 'vitest';
import { officialDecks, parseSetList, parseSetListBlocks, setListTitles } from './set-list.parser';

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

// Extraits réels : « Legendary 5D's Decks » et « 2-Player Starter Set »
const L5DD = `{{Set page header}}
== Yusei Deck ==
{{Set list|region=EN|rarities=Common|print=Reprint|qty=1|
L5DD-ENS01; Stardust Dragon; Secret Rare
L5DD-ENS04; Token (card); Secret Rare //description::(Yusei)
L5DD-EN001; Junk Synchron
}}
== Akiza Deck ==
{{Set list|region=EN|rarities=Common|print=Reprint|qty=1|
L5DD-ENS02; Black Rose Dragon; Secret Rare
L5DD-EN041; Twilight Rose Knight;; ; 2
}}
== Crow Deck ==
{{Set list|region=EN|rarities=Common|print=Reprint|qty=1|
L5DD-ENS03; Black-Winged Dragon; Secret Rare
}}`;

const LDK2 = `==Yugi Deck==
{{Set list|region=EN|rarities=C|print=Reprint|
LDK2-ENY01; Dark Magician
}}
==Promotional cards==
{{Set list|region=EN|rarities=ScR|print=New|
LDK2-ENS01; Obelisk the Tormentor
}}`;

describe('decks officiels', () => {
  it('un deck par section « … Deck », sans les jetons', () => {
    const decks = officialDecks(parseSetListBlocks(L5DD), false);
    expect(decks.map((d) => d.name)).toEqual(['Yusei Deck', 'Akiza Deck', 'Crow Deck']);
    expect(decks[0]?.rows.map((r) => r.name)).toEqual(['Stardust Dragon', 'Junk Synchron']);
    expect(decks[1]?.rows.find((r) => r.name === 'Twilight Rose Knight')?.quantity).toBe(2);
  });

  it('ignore les promos ; un seul deck + produit-deck = tout le produit', () => {
    expect(officialDecks(parseSetListBlocks(LDK2), false).map((d) => d.name)).toEqual([
      'Yugi Deck',
    ]);
    const sdbe = officialDecks(parseSetListBlocks(SDBE), true);
    expect(sdbe).toHaveLength(1);
    expect(sdbe[0]?.name).toBeNull();
    expect(sdbe[0]?.rows).toHaveLength(6);
  });

  it('booster (pas un deck, pas de section deck) : rien', () => {
    expect(officialDecks(parseSetListBlocks(SDBE), false)).toEqual([]);
  });
});
