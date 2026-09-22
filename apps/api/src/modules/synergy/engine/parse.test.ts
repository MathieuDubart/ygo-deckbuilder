import { describe, expect, it } from 'vitest';
import {
  ABYSS,
  ALTERNATIVE,
  ASH,
  BEWD,
  DICTATOR,
  LINKURIBOH,
  MAJESTY,
  POLYMERIZATION,
  SAGE,
  SPIRIT_DRAGON,
  TITANIC,
  TWIN_BURST,
  ULTIMATE_SPIRIT,
  WHITE_STONE_ANCIENTS,
  WHITE_STONE_LEGEND,
} from './fixtures';
import { matches, parseCard, parseFilters } from './parse';

describe('parseFilters', () => {
  it('lit niveau, attribut et syntoniseur, avec exception', () => {
    const [f] = parseFilters('1 Level 1 LIGHT Tuner, except "Sage with Eyes of Blue"');
    expect(f).toMatchObject({
      levelEq: 1,
      attributes: ['LIGHT'],
      tuner: true,
      except: ['Sage with Eyes of Blue'],
    });
  });

  it('gère les alternatives et les seuils', () => {
    const fs = parseFilters('1 Ritual Spell or 1 "Polymerization"');
    expect(fs).toHaveLength(2);
    expect(fs[0]).toMatchObject({ kinds: ['SPELL'], subtypes: ['Ritual'] });
    expect(fs[1]!.quoted).toEqual(['Polymerization']);
    expect(parseFilters('1 Level 8 or higher Dragon monster')[0]).toMatchObject({
      levelMin: 8,
      races: ['Dragon'],
    });
  });
});

describe('parseCard (textes réels)', () => {
  it('Sage with Eyes of Blue : cherche un syntoniseur, invoque un Blue-Eyes depuis le Deck', () => {
    const f = parseCard(SAGE);
    expect(f.normalSummonTrigger).toBe(true);
    expect(f.oncePerTurn).toBe(true);
    expect(f.actions.map((a) => [a.verb, a.from])).toEqual([
      ['SEARCH', ['DECK']],
      ['SPECIAL_SUMMON', ['DECK']],
    ]);
  });

  it('White Stones : invocation depuis le Deck / recherche de Blue-Eyes', () => {
    expect(parseCard(WHITE_STONE_ANCIENTS).actions[0]).toMatchObject({
      verb: 'SPECIAL_SUMMON',
      from: ['DECK'],
    });
    expect(parseCard(WHITE_STONE_LEGEND).actions[0]!.filters[0]!.quoted).toEqual([
      'Blue-Eyes White Dragon',
    ]);
  });

  it('Dictator of D. : s’invoque seul et envoie un Blue-Eyes au cimetière', () => {
    const f = parseCard(DICTATOR);
    expect(f.selfSummon).toBe(true);
    expect(f.actions.some((a) => a.verb === 'SEND_GY' && a.from.includes('DECK'))).toBe(true);
  });

  it('Alternative : ne s’invoque pas normalement, détruit un monstre adverse', () => {
    const f = parseCard(ALTERNATIVE);
    expect(f.cannotNormalSummon).toBe(true);
    expect(f.removal).toBe(true);
  });

  it('Ash Blossom est un hand trap qui annule', () => {
    const f = parseCard(ASH);
    expect(f.handTrap).toBe(true);
    expect(f.negates).toBe(true);
  });

  it('Abyss Dragon cherche Polymerization / Rituel et les gros Dragons', () => {
    const f = parseCard(ABYSS);
    expect(f.actions.filter((a) => a.verb === 'SEARCH')).toHaveLength(2);
  });

  it('Majesty envoie un Blue-Eyes de la main ou du Deck', () => {
    expect(parseCard(MAJESTY).actions[0]).toMatchObject({
      verb: 'SEND_GY',
      from: ['HAND', 'DECK'],
    });
  });

  it('Polymerization active les Fusions', () => {
    expect(parseCard(POLYMERIZATION).fusionEnabler).toBe(true);
  });
});

describe('matériaux', () => {
  it('Synchro', () => {
    const m = parseCard(SPIRIT_DRAGON).materials!;
    expect(m).toMatchObject({
      mechanic: 'SYNCHRO',
      level: 9,
      tuner: { count: 1 },
      nonTuner: { min: 1 },
    });
    expect(m.nonTuner!.filter.quoted).toEqual(['Blue-Eyes']);
    expect(parseCard(ULTIMATE_SPIRIT).materials).toMatchObject({ tuner: { count: 2 }, level: 12 });
  });

  it('Fusion, Xyz, Link', () => {
    expect(parseCard(TWIN_BURST).materials!.parts.map((p) => p.filter.quoted[0])).toEqual([
      'Blue-Eyes White Dragon',
      'Blue-Eyes White Dragon',
    ]);
    expect(parseCard(TITANIC).materials).toMatchObject({ mechanic: 'XYZ', count: 2, level: 8 });
    expect(parseCard(LINKURIBOH).materials).toMatchObject({ mechanic: 'LINK', count: 1 });
  });
});

describe('matches', () => {
  it('"Blue-Eyes" monster couvre l’archétype, pas les autres', () => {
    const [f] = parseFilters('1 "Blue-Eyes" monster');
    expect(matches(BEWD, f!)).toBe(true);
    expect(matches(ALTERNATIVE, f!)).toBe(true);
    expect(matches(SAGE, f!)).toBe(false);
  });

  it('Level 1 LIGHT Tuner', () => {
    const [f] = parseFilters('1 Level 1 LIGHT Tuner, except "Sage with Eyes of Blue"');
    expect(matches(WHITE_STONE_ANCIENTS, f!)).toBe(true);
    expect(matches(SAGE, f!)).toBe(false); // exception
    expect(matches(ASH, f!)).toBe(false); // niveau 3, FIRE
  });
});

describe('déclencheurs et coûts', () => {
  it('Sage : recherche à l’Invocation Normale, invocation en se défaussant', () => {
    const [search, summon] = parseCard(SAGE).actions;
    expect(search).toMatchObject({ trigger: 'NS', fromHand: false });
    expect(summon).toMatchObject({ trigger: 'IGNITION', fromHand: true });
  });

  it('White Stones : effets de cimetière (dont End Phase)', () => {
    expect(parseCard(WHITE_STONE_ANCIENTS).actions[0]!.trigger).toBe('END_PHASE_GY');
    expect(parseCard(WHITE_STONE_LEGEND).actions[0]!.trigger).toBe('SENT_GY');
  });

  it('Abyss : recherche quand invoqué spécialement, puis en End Phase', () => {
    expect(parseCard(ABYSS).actions.map((a) => a.trigger)).toEqual(['SS', 'END_PHASE']);
  });
});
