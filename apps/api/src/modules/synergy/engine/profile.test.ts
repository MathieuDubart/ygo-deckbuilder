import { describe, expect, it } from 'vitest';
import {
  BLUE_EYES_DECK,
  EVENLY_MATCHED,
  LIGHTNING_STORM,
  RAIGEKI,
  RIVALRY,
  SKILL_DRAIN,
  VANITYS_EMPTINESS,
} from './fixtures';
import { analyzeDeck, type DeckEntry } from './graph';
import {
  allMatchups,
  countProfile,
  matchup,
  profileDeck,
  type DeckProfile,
  type DeckStyle,
} from './profile';

const entries = (list: { card: DeckEntry['card']; qty: number }[]): DeckEntry[] =>
  list.map(({ card, qty }) => ({
    card,
    quantity: qty,
    zone: card.isExtraDeck ? ('EXTRA' as const) : ('MAIN' as const),
  }));

const blueEyes = entries(BLUE_EYES_DECK);

/** Un profil neutre, qu'on déforme sur un seul axe pour isoler ce qu'on teste. */
const flat = (style: DeckStyle, over: Partial<DeckProfile> = {}): DeckProfile => ({
  style,
  setup: 0.5,
  disruption: 0.5,
  handInteraction: 0.5,
  breaking: 0.5,
  lock: 0.5,
  resilience: 0.5,
  consistency: 0.5,
  ...over,
});

describe('countProfile', () => {
  it('compte les verrous et les casse-terrain du main', () => {
    const deck = entries([
      ...BLUE_EYES_DECK,
      { card: VANITYS_EMPTINESS, qty: 3 },
      { card: RAIGEKI, qty: 1 },
      { card: LIGHTNING_STORM, qty: 2 },
    ]);
    const counts = countProfile(deck, analyzeDeck(deck));
    expect(counts.floodgates).toBe(3);
    expect(counts.boardBreakers).toBe(3);
  });

  it('ne compte que le main deck', () => {
    const counts = countProfile(blueEyes, analyzeDeck(blueEyes));
    // 6 monstres d'Extra dans la fixture, hors du compte
    expect(counts.mainCopies).toBe(26);
  });
});

describe('style d’un deck', () => {
  it('reconnaît un deck à verrous dès que les verrous sont le plan', () => {
    const deck = entries([
      ...BLUE_EYES_DECK,
      { card: VANITYS_EMPTINESS, qty: 3 },
      { card: SKILL_DRAIN, qty: 2 },
    ]);
    expect(profileDeck(deck, analyzeDeck(deck)).style).toBe('STUN');
  });

  it('ne prend pas deux verrous d’appoint pour un plan de jeu', () => {
    const deck = entries([...BLUE_EYES_DECK, { card: RIVALRY, qty: 1 }]);
    expect(profileDeck(deck, analyzeDeck(deck)).style).not.toBe('STUN');
  });

  it('donne un style à un vrai deck sans rien inventer', () => {
    const profile = profileDeck(blueEyes, analyzeDeck(blueEyes));
    expect(['COMBO', 'MIDRANGE', 'CONTROL', 'STUN', 'BEATDOWN']).toContain(profile.style);
    for (const axis of ['setup', 'disruption', 'handInteraction', 'breaking', 'lock'] as const) {
      expect(profile[axis]).toBeGreaterThanOrEqual(0);
      expect(profile[axis]).toBeLessThanOrEqual(1);
    }
  });

  it('voit les cartes de main du deck Blue-Eyes', () => {
    // 3 Ash Blossom : l'axe « depuis la main » ne doit pas être nul
    expect(profileDeck(blueEyes, analyzeDeck(blueEyes)).handInteraction).toBeGreaterThan(0);
  });
});

describe('pronostics', () => {
  it('les cartes de main sont ce qui arrête un deck combo', () => {
    const withTraps = matchup(flat('MIDRANGE', { handInteraction: 1 }), 'COMBO');
    const without = matchup(flat('MIDRANGE', { handInteraction: 0 }), 'COMBO');
    expect(withTraps.verdict).toBe('GOOD');
    expect(withTraps.reason).toBe('HAND_TRAPS');
    expect(without.verdict).toBe('BAD');
    expect(without.reason).toBe('NO_HAND_TRAPS');
  });

  it('un plan qui dépend d’un plateau souffre face aux verrous', () => {
    // Un verrou ne se négocie pas depuis la main : sans quoi le casser, on subit, et les
    // cartes de main n'y changent rien.
    const combo = flat('COMBO', { setup: 1, breaking: 0, handInteraction: 1 });
    expect(matchup(combo, 'STUN')).toMatchObject({ verdict: 'BAD', reason: 'NO_BREAKERS' });
  });

  it('… et c’est la dépendance au plateau qu’on pointe quand le reste est moyen', () => {
    const combo = flat('COMBO', { setup: 1, breaking: 0.5 });
    expect(matchup(combo, 'STUN')).toMatchObject({ verdict: 'BAD', reason: 'FRAGILE_SETUP' });
  });

  it('… et s’en sort dès qu’il peut casser', () => {
    const combo = flat('COMBO', { setup: 1, breaking: 1 });
    expect(matchup(combo, 'STUN').verdict).toBe('GOOD');
    expect(matchup(combo, 'STUN').reason).toBe('BREAKERS');
  });

  it('casser et revenir est ce qui bat le contrôle', () => {
    const grindy = flat('MIDRANGE', { breaking: 1, resilience: 1 });
    expect(matchup(grindy, 'CONTROL').verdict).toBe('GOOD');
    const fragile = flat('COMBO', { breaking: 0, resilience: 0 });
    expect(matchup(fragile, 'CONTROL').verdict).toBe('BAD');
  });

  it('n’explique jamais par un axe sur lequel il n’y a rien à faire', () => {
    // Manquer de verrous n'est pas un conseil : la vraie cause est ailleurs, et c'est elle
    // qu'on doit lire, même quand le manque de verrous pèse davantage dans le calcul.
    const noLock = flat('MIDRANGE', { lock: 0, handInteraction: 0.2, disruption: 0.2 });
    expect(matchup(noLock, 'COMBO').reason).toBe('NO_HAND_TRAPS');
  });

  it('dit « aucune interaction » quand c’est ça qui manque', () => {
    const passive = flat('COMBO', { disruption: 0, breaking: 0.5, setup: 0.5 });
    expect(matchup(passive, 'BEATDOWN')).toMatchObject({
      verdict: 'BAD',
      reason: 'NO_DISRUPTION',
    });
  });

  it('deux decks moyens se valent', () => {
    expect(matchup(flat('MIDRANGE'), 'MIDRANGE').verdict).toBe('EVEN');
    expect(matchup(flat('MIDRANGE'), 'MIDRANGE').reason).toBe('BALANCED');
  });

  it('connaître le deck adverse nuance le pronostic', () => {
    const mine = flat('COMBO', { setup: 1, handInteraction: 1, breaking: 0.5 });
    const blind = matchup(mine, 'COMBO');
    const theyInterrupt = matchup(mine, 'COMBO', flat('COMBO', { handInteraction: 1, lock: 1 }));
    // Les mêmes cartes face à un adversaire qui sait nous arrêter : moins bien
    expect(theyInterrupt.edge).toBeLessThan(blind.edge);
  });

  it('rend les cinq pronostics, du meilleur au pire', () => {
    const list = allMatchups(flat('COMBO', { handInteraction: 1, breaking: 0 }));
    expect(list).toHaveLength(5);
    expect(list.map((m) => m.against).sort()).toEqual(
      ['BEATDOWN', 'COMBO', 'CONTROL', 'MIDRANGE', 'STUN'].sort(),
    );
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i - 1]!.edge).toBeGreaterThanOrEqual(list[i]!.edge);
    }
  });

  it('reste borné quoi qu’on lui donne', () => {
    for (const value of [0, 1]) {
      for (const style of ['COMBO', 'MIDRANGE', 'CONTROL', 'STUN', 'BEATDOWN'] as const) {
        const extreme = flat(style, {
          setup: value,
          disruption: value,
          handInteraction: value,
          breaking: value,
          lock: value,
          resilience: value,
          consistency: value,
        });
        const m = matchup(extreme, style, extreme);
        expect(m.edge).toBeGreaterThanOrEqual(-1);
        expect(m.edge).toBeLessThanOrEqual(1);
      }
    }
  });

  it('un vrai deck donne un pronostic utilisable contre chaque style', () => {
    const profile = profileDeck(blueEyes, analyzeDeck(blueEyes));
    for (const m of allMatchups(profile)) {
      expect(['GOOD', 'EVEN', 'BAD']).toContain(m.verdict);
      expect(m.against).toBeTruthy();
    }
  });
});

describe('casse-terrain dans un vrai deck', () => {
  it('Evenly Matched compte comme de quoi casser', () => {
    const deck = entries([...BLUE_EYES_DECK, { card: EVENLY_MATCHED, qty: 3 }]);
    const withIt = profileDeck(deck, analyzeDeck(deck));
    const without = profileDeck(blueEyes, analyzeDeck(blueEyes));
    expect(withIt.breaking).toBeGreaterThan(without.breaking);
  });
});
