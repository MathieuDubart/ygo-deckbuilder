import { describe, expect, it } from 'vitest';
import { parseUpcomingSets, upcomingSetsQuery, type AskResponse } from './upcoming-sets.parser';

/**
 * Extrait réel de l'API sémantique de Yugipedia (action=ask, octobre 2026), raccourci aux
 * champs lus. Les cas tordus sont tous là : nom absent (on retombe sur le titre de page),
 * carte promotionnelle à écarter, et une page régionale qui double une extension.
 */
const response: AskResponse = {
  query: {
    results: {
      'Magnificent Monsters': {
        fulltext: 'Magnificent Monsters',
        printouts: {
          'English name': ['Magnificent Monsters'],
          'English release date': [{ timestamp: '1788393600', raw: '1/2026/9/3' }],
          'English set prefix': ['MAMO'],
          'Set type': [{ fulltext: "Collector's Set" }],
        },
      },
      'Demo Decks 2026': {
        fulltext: 'Demo Decks 2026',
        printouts: {
          'English name': [],
          'English release date': [{ timestamp: '1788393600', raw: '1/2026/9/3' }],
          'English set prefix': ['26DE'],
          'Set type': [{ fulltext: 'Demo Deck' }],
        },
      },
      'Beyond the Brave Premiere! promotional card': {
        fulltext: 'Beyond the Brave Premiere! promotional card',
        printouts: {
          'English name': ['Beyond the Brave Premiere!'],
          'English release date': [{ timestamp: '1790899200', raw: '1/2026/10/2' }],
          'English set prefix': ['BETB'],
          'Set type': [{ fulltext: 'Promotional card' }],
        },
      },
      'Beyond the Brave': {
        fulltext: 'Beyond the Brave',
        printouts: {
          'English name': ['Beyond the Brave'],
          'English release date': [{ timestamp: '1791417600', raw: '1/2026/10/8' }],
          'English set prefix': ['BETB'],
          'Set type': [{ fulltext: 'Booster pack' }],
        },
      },
      'Glorious Victors': {
        fulltext: 'Glorious Victors',
        printouts: {
          'English name': ['Glorious Victors'],
          'English release date': [{ timestamp: '1796256000', raw: '1/2026/12/3' }],
          'English set prefix': ['GLVI'],
          'Set type': [{ fulltext: 'Booster pack' }],
        },
      },
      'Immortal Phoenix': {
        fulltext: 'Immortal Phoenix',
        printouts: {
          'English name': ['Immortal Phoenix'],
          'English release date': [{ timestamp: '1801094400', raw: '1/2027/1/28' }],
          'English set prefix': ['IMPH'],
          'Set type': [{ fulltext: 'Booster pack' }],
        },
      },
    },
  },
};

const now = new Date('2026-10-07T22:00:00Z');

describe('parseUpcomingSets', () => {
  it('ne garde que les sorties encore à venir, par date croissante', () => {
    expect(parseUpcomingSets(response, now).map((s) => s.name)).toEqual([
      'Beyond the Brave',
      'Glorious Victors',
      'Immortal Phoenix',
    ]);
  });

  it('lit le code et la date de sortie', () => {
    const [first] = parseUpcomingSets(response, now);
    expect(first).toMatchObject({
      name: 'Beyond the Brave',
      code: 'BETB',
      setType: 'Booster pack',
    });
    expect(first!.tcgDate.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });

  it('écarte les cartes promotionnelles et les decks de démonstration', () => {
    const names = parseUpcomingSets(response, now).map((s) => s.name);
    expect(names).not.toContain('Beyond the Brave Premiere!');
    expect(names).not.toContain('Demo Decks 2026');
  });

  it('garde la sortie du jour même', () => {
    const sameDay = new Date('2026-10-08T23:59:00Z');
    expect(parseUpcomingSets(response, sameDay).map((s) => s.name)).toContain('Beyond the Brave');
  });

  it('retombe sur le titre de la page quand le nom anglais manque', () => {
    const noName: AskResponse = {
      query: {
        results: {
          'Mystery Box': {
            fulltext: 'Mystery Box',
            printouts: {
              'English release date': [{ timestamp: '1801094400' }],
              'Set type': [{ fulltext: 'Booster pack' }],
            },
          },
        },
      },
    };
    expect(parseUpcomingSets(noName, now)).toEqual([
      {
        name: 'Mystery Box',
        code: null,
        tcgDate: new Date('2027-01-28T00:00:00.000Z'),
        setType: 'Booster pack',
      },
    ]);
  });

  it('se rabat sur la date brute quand l_horodatage manque', () => {
    const rawOnly: AskResponse = {
      query: {
        results: [
          {
            fulltext: 'Raw Date Pack',
            printouts: {
              'English release date': [{ raw: '1/2027/3/4' }],
              'Set type': ['Booster pack'],
            },
          },
        ],
      },
    };
    expect(parseUpcomingSets(rawOnly, now)[0]!.tcgDate.toISOString()).toBe(
      '2027-03-04T00:00:00.000Z',
    );
  });

  it('ignore les résultats sans date', () => {
    const noDate: AskResponse = {
      query: { results: { Vapor: { fulltext: 'Vapor', printouts: {} } } },
    };
    expect(parseUpcomingSets(noDate, now)).toEqual([]);
  });

  it('ne garde qu_une fois une extension listée deux fois', () => {
    const twice: AskResponse = {
      query: {
        results: [
          {
            fulltext: 'Beyond the Brave',
            printouts: {
              'English name': ['Beyond the Brave'],
              'English release date': [{ timestamp: '1791417600' }],
              'English set prefix': ['BETB'],
            },
          },
          {
            fulltext: 'Beyond the Brave (Europe)',
            printouts: {
              'English name': ['Beyond the Brave'],
              'English release date': [{ timestamp: '1791417600' }],
              'English set prefix': ['BETB'],
            },
          },
        ],
      },
    };
    expect(parseUpcomingSets(twice, now)).toHaveLength(1);
  });

  it('supporte une réponse vide', () => {
    expect(parseUpcomingSets({}, now)).toEqual([]);
    expect(parseUpcomingSets({ query: {} }, now)).toEqual([]);
  });
});

describe('upcomingSetsQuery', () => {
  it('interroge les sorties postérieures à la date donnée', () => {
    expect(upcomingSetsQuery(new Date('2026-10-01T12:00:00Z'), 200)).toBe(
      '[[Category:All sets]]|[[English release date::>2026-10-01]]|?English name|' +
        '?English release date|?English set prefix|?Set type|limit=200|' +
        'sort=English release date|order=asc',
    );
  });
});
