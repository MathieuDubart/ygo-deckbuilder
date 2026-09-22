import { describe, expect, it } from 'vitest';
import { matches } from './parse';
import { featuresOf } from './graph';
import { describeFilter, nameKeys, precisionOf, targetsOfCard } from './interactions';
import {
  ASH,
  BEWD,
  DICTATOR,
  SAGE,
  SPIRIT_DRAGON,
  TITANIC,
  TRADE_IN,
  TWIN_BURST,
  WHITE_STONE_LEGEND,
} from './fixtures';

describe('cibles d’une carte', () => {
  it('Sage : cherche un Syntoniseur LIGHT niveau 1 (précis) et invoque un « Blue-Eyes » (direct)', () => {
    const t = targetsOfCard(SAGE);
    const search = t.find((x) => x.verb === 'SEARCH')!;
    expect(search.precision).toBe(1);
    expect(describeFilter(search.filter)).toBe('Syntoniseur LUMIÈRE de niveau 1');
    const ss = t.find((x) => x.verb === 'SPECIAL_SUMMON')!;
    expect(ss.precision).toBe(2);
    expect(ss.keys).toContain('blue-eyes');
  });

  it('matériaux : Twin Burst cite Blue-Eyes White Dragon, Titanic = 2 niveau 8 (générique)', () => {
    const tb = targetsOfCard(TWIN_BURST).filter((x) => x.verb === 'MATERIAL');
    expect(tb[0]?.keys).toEqual(['blue-eyes white dragon']);
    const ti = targetsOfCard(TITANIC).find((x) => x.verb === 'MATERIAL')!;
    expect(ti.filter.levelEq).toBe(8);
    expect(ti.precision).toBe(0);
    const sp = targetsOfCard(SPIRIT_DRAGON).filter((x) => x.verb === 'MATERIAL');
    expect(sp.some((x) => x.keys.includes('blue-eyes'))).toBe(true);
  });

  it('Ash : pas de fausse cible (texte générique en puces)', () => {
    expect(targetsOfCard(ASH).filter((x) => x.precision > 0)).toEqual([]);
  });

  it('Trade-In : défausse d’un niveau 8, rien d’indexable', () => {
    expect(targetsOfCard(TRADE_IN).filter((x) => x.precision > 0)).toEqual([]);
  });
});

describe('recherche inverse', () => {
  it('les clés de BEWD permettent de le retrouver depuis « Blue-Eyes »', () => {
    const keys = nameKeys(BEWD);
    expect(keys).toEqual(
      expect.arrayContaining(['blue-eyes white dragon', 'blue-eyes', 'white dragon']),
    );
    const legend = targetsOfCard(WHITE_STONE_LEGEND).find((x) => x.verb === 'SEARCH')!;
    expect(legend.keys.some((k) => keys.includes(k))).toBe(true);
    expect(matches(BEWD, legend.filter, featuresOf(BEWD), legend.locations)).toBe(true);
  });

  it('Dictator vise les « Blue-Eyes » au cimetière', () => {
    const t = targetsOfCard(DICTATOR).filter((x) => x.precision === 2);
    expect(t.map((x) => x.verb)).toEqual(expect.arrayContaining(['SEND_GY', 'SPECIAL_SUMMON']));
  });

  it('précision', () => {
    expect(
      precisionOf({
        quoted: [],
        except: [],
        kinds: ['MONSTER'],
        subtypes: [],
        races: [],
        attributes: [],
      }),
    ).toBe(0);
  });
});
