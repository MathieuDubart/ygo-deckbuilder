import { describe, expect, it } from 'vitest';
import { findCombos } from './combos';
import {
  ASH,
  BEWD,
  BLUE_EYES_DECK,
  DICTATOR,
  LINKURIBOH,
  RANK7,
  SAGE,
  SPIRIT_DRAGON,
  TITANIC,
  TWIN_BURST,
  ULTIMATE,
  ULTIMATE_SPIRIT,
  WHITE_STONE_LEGEND,
} from './fixtures';
import { analyzeDeck, type DeckEntry } from './graph';

const deck: DeckEntry[] = BLUE_EYES_DECK.map(({ card, qty }) => ({
  card,
  quantity: qty,
  zone: card.isExtraDeck ? 'EXTRA' : 'MAIN',
}));
const a = analyzeDeck(deck);

describe('graphe de synergie (deck Blue-Eyes réel)', () => {
  it('relie les chercheurs à leurs cibles', () => {
    expect(a.edges).toContainEqual({ from: SAGE.id, to: WHITE_STONE_LEGEND.id, verb: 'SEARCH' });
    expect(a.edges).toContainEqual({ from: WHITE_STONE_LEGEND.id, to: BEWD.id, verb: 'SEARCH' });
    expect(a.edges).toContainEqual({ from: DICTATOR.id, to: BEWD.id, verb: 'SEND_GY' });
  });

  it('attribue les rôles', () => {
    expect(a.roles.get(SAGE.id)).toEqual(expect.arrayContaining(['STARTER', 'SEARCHER']));
    expect(a.roles.get(DICTATOR.id)).toEqual(expect.arrayContaining(['STARTER', 'EXTENDER']));
    expect(a.roles.get(ASH.id)).toContain('HAND_TRAP');
    expect(a.roles.get(WHITE_STONE_LEGEND.id)).not.toContain('STARTER'); // a besoin d'aller au cimetière
  });

  it('sait quels monstres de l’Extra Deck sont invocables', () => {
    const r = (id: number) => a.extra.find((x) => x.cardId === id)?.reachable;
    expect(r(SPIRIT_DRAGON.id)).toBe(true); // Sage (1) + Blue-Eyes (8) = 9
    expect(r(ULTIMATE_SPIRIT.id)).toBe(true); // Ash (3) + Sage (1) + Blue-Eyes (8) = 12
    expect(r(TWIN_BURST.id)).toBe(true); // Fusion de contact avec 2 BEWD
    expect(r(ULTIMATE.id)).toBe(true); // 3 BEWD + Polymerization
    expect(r(TITANIC.id)).toBe(true); // 2 niveaux 8
    expect(r(LINKURIBOH.id)).toBe(true); // 1 monstre niveau 1
    expect(r(RANK7.id)).toBe(false); // aucun monstre de niveau 7
  });

  it('calcule un score de synergie élevé pour un deck cohérent', () => {
    expect(a.synergy.connectedShare).toBeGreaterThan(0.6);
    expect(a.synergy.score).toBeGreaterThan(0.6);
    expect(a.normalSummonStarters).toContain(SAGE.id);
  });
});

describe('lignes de combo', () => {
  const combos = findCombos(deck, a);

  it('trouve une ligne qui finit sur un boss de l’Extra Deck', () => {
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.some((c) => c.bossId !== null)).toBe(true);
  });

  it('la ligne de Sage : Invocation Normale → recherche → … → Synchro', () => {
    const sage = combos.find((c) => c.starterId === SAGE.id)!;
    expect(sage.steps[0]).toEqual({ kind: 'NORMAL_SUMMON', cardId: SAGE.id });
    expect(sage.steps[1]).toMatchObject({ kind: 'SEARCH', cardId: SAGE.id });
    expect(sage.steps.some((s) => s.kind === 'EXTRA_SUMMON')).toBe(true);
  });
});
