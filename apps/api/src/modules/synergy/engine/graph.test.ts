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
import {
  analyzeDeck,
  buildEdges,
  checkExtra,
  featuresOf,
  linkQuality,
  type DeckEntry,
  type Edge,
} from './graph';
import type { SynCard } from './types';

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

describe('liens de réserve (restrictEdges)', () => {
  it('donne exactement l’analyse du deck seul', () => {
    // Un deck plus petit que la réserve : ses liens, extraits de la réserve, sont les siens
    const subset = deck.filter((e) => e.card.id !== DICTATOR.id && e.card.id !== TITANIC.id);
    const pool = buildEdges(deck);
    const direct = analyzeDeck(subset);
    const viaPool = analyzeDeck(subset, { poolEdges: pool });
    const key = (e: Edge) => `${e.from}>${e.to}:${e.verb}:${e.weak ? 'w' : ''}`;
    expect(viaPool.edges.map(key).sort()).toEqual(direct.edges.map(key).sort());
    expect(viaPool.synergy).toEqual(direct.synergy);
    expect([...viaPool.roles].sort()).toEqual([...direct.roles].sort());
    expect(viaPool.extra).toEqual(direct.extra);
    expect(viaPool.bricks).toEqual(direct.bricks);
  });
});

/** Carte générique : son effet vise « 1 monstre », sans rien d'autre (texte inventé). */
const generic = (id: number, desc: string): SynCard => ({
  id,
  name: `Generic ${id}`,
  desc,
  type: 'Spell Card',
  frameType: 'spell',
  category: 'SPELL',
  race: 'Normal',
  attribute: null,
  level: null,
  linkVal: null,
  archetype: null,
  isExtraDeck: false,
});

describe('qualité des liens', () => {
  const vanilla: SynCard = {
    ...BEWD,
    id: 9001,
    name: 'Plain Vanilla',
    desc: 'A very ordinary monster.',
    level: 4,
    archetype: null,
  };

  it('un vrai lien : nom ou archétype cité', () => {
    const [search] = featuresOf(WHITE_STONE_LEGEND).actions;
    expect(linkQuality(search!, BEWD, featuresOf(BEWD))).toBe(2);
  });

  it('une recherche sans aucun critère est un lien faible', () => {
    // « add 1 monster » cache presque toujours une condition non lue : on ne la croit pas
    const any = generic(9002, 'Add 1 monster from your Deck to your hand.');
    const [action] = featuresOf(any).actions;
    expect(linkQuality(action!, SAGE, featuresOf(SAGE))).toBe(1);
    const edges = buildEdges([
      { card: any, quantity: 3, zone: 'MAIN' },
      { card: SAGE, quantity: 3, zone: 'MAIN' },
    ]);
    expect(edges).toContainEqual({ from: any.id, to: SAGE.id, verb: 'SEARCH', weak: true });
  });

  it('un lien faible ne fait ni starter ni synergie', () => {
    const any = generic(9003, 'Add 1 monster from your Deck to your hand.');
    const a = analyzeDeck([
      { card: any, quantity: 3, zone: 'MAIN' },
      { card: vanilla, quantity: 3, zone: 'MAIN' },
    ]);
    expect(a.roles.get(any.id)).not.toContain('STARTER');
    expect(a.synergy.connectedShare).toBe(0);
  });

  it('envoyer au cimetière sans critère vaut un lien si la cible a un effet de cimetière', () => {
    // Foolish Burial vers White Stone of Legend : c'est tout l'intérêt de la carte
    const burial = generic(9004, 'Send 1 monster from your Deck to the GY.');
    const [send] = featuresOf(burial).actions;
    expect(linkQuality(send!, WHITE_STONE_LEGEND, featuresOf(WHITE_STONE_LEGEND))).toBe(2);
    expect(linkQuality(send!, vanilla, featuresOf(vanilla))).toBe(1);
  });
});

describe('Synchro : réponse rapide', () => {
  it('dit non sans tout énumérer quand aucune somme de niveaux ne tombe juste', () => {
    // Que des niveaux 8 et un syntoniseur niveau 1 : Spirit Dragon (9) oui, un Synchro 12 non
    const main: DeckEntry[] = [
      { card: SAGE, quantity: 3, zone: 'MAIN' },
      { card: BEWD, quantity: 3, zone: 'MAIN' },
    ];
    expect(checkExtra(SPIRIT_DRAGON, main).reachable).toBe(true);
    expect(checkExtra(SPIRIT_DRAGON, main).materialIds.sort()).toEqual([SAGE.id, BEWD.id].sort());
    expect(checkExtra(ULTIMATE_SPIRIT, main).reachable).toBe(false);
  });
});
