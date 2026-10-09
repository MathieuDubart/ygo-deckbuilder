import { describe, expect, it } from 'vitest';
import { mainTargetFor, officialCandidates, type OfficialCard } from './product-deck-build';

const card = (cardId: number, quantity: number, deckShare?: number): OfficialCard => ({
  cardId,
  quantity,
  deckShare,
});

describe('officialCandidates', () => {
  it('triple les exemplaires, sans dépasser trois', () => {
    const [one, two, three] = officialCandidates([card(1, 1), card(2, 2), card(3, 3)], 3);
    // La carte déjà en trois ne monte pas à neuf : la limite du jeu s'applique
    expect(three!.want).toBe(3);
    expect(two!.want).toBe(3);
    expect(one!.want).toBe(3);
  });

  it('laisse la liste intacte avec une seule boîte', () => {
    const got = officialCandidates([card(1, 1), card(2, 2)], 1);
    expect(got.map((c) => [c.cardId, c.want])).toEqual([
      [2, 2],
      [1, 1],
    ]);
  });

  it('met en tête ce que les concepteurs ont déjà mis en plusieurs exemplaires', () => {
    // C'est l'ordre qui fait le montage : l'assembleur s'arrête quand le main est plein,
    // donc ce qui est en queue est ce qu'on coupe.
    const got = officialCandidates([card(1, 1), card(2, 3), card(3, 2)], 3);
    expect(got.map((c) => c.cardId)).toEqual([2, 3, 1]);
  });

  it('départage à égalité par le taux de jeu en tournoi', () => {
    const got = officialCandidates([card(1, 1, 0.02), card(2, 1, 0.41), card(3, 1)], 3);
    expect(got.map((c) => c.cardId)).toEqual([2, 1, 3]);
  });

  it('donne deux fois la même liste pour le même produit', () => {
    const cards = [card(7, 1), card(3, 1), card(9, 1)];
    const a = officialCandidates(cards, 3).map((c) => c.cardId);
    const b = officialCandidates([...cards].reverse(), 3).map((c) => c.cardId);
    expect(a).toEqual(b);
  });

  it('ne touche pas à la liste reçue', () => {
    const cards = [card(1, 1), card(2, 3)];
    officialCandidates(cards, 3);
    expect(cards.map((c) => c.cardId)).toEqual([1, 2]);
  });

  it('traite zéro boîte comme une', () => {
    expect(officialCandidates([card(1, 2)], 0)[0]!.want).toBe(2);
  });
});

describe('mainTargetFor', () => {
  it('reproduit la liste vendue quand on n’a qu’une boîte', () => {
    // Un structure deck fait 41 cartes : le tronquer à 40 donnerait un deck que
    // personne n'a jamais vu.
    const cards = Array.from({ length: 41 }, (_, i) => card(i, 1));
    expect(mainTargetFor(cards, 1)).toBe(41);
  });

  it('vise le minimum légal dès qu’on en monte plusieurs', () => {
    const cards = Array.from({ length: 41 }, (_, i) => card(i, 1));
    expect(mainTargetFor(cards, 3)).toBe(40);
  });

  it('ne descend jamais sous quarante', () => {
    expect(mainTargetFor([card(1, 1)], 1)).toBe(40);
  });
});
