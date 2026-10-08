import { describe, expect, it } from 'vitest';
import { banlistWrites, countChanges, indexByCard, type CardBanRow } from './banlist.diff';
import type { BanlistEntry } from './banlist.parser';

const entry = (cardId: number, label: string, status: BanlistEntry['status']): BanlistEntry => ({
  cardId,
  label,
  status,
});

const lists = (tcg: BanlistEntry[] = [], ocg: BanlistEntry[] = []) => ({
  banTcg: indexByCard(tcg),
  banOcg: indexByCard(ocg),
});

describe('banlistWrites', () => {
  it('écrit le statut d’une carte qui arrive sur la liste', () => {
    const current: CardBanRow[] = [{ id: 1, banTcg: null, banOcg: null }];
    expect(banlistWrites(current, lists([entry(1, 'Limited', 'LIMITED')]))).toEqual([
      { column: 'banTcg', label: 'Limited', cardIds: [1] },
    ]);
  });

  it('EFFACE le statut d’une carte sortie de la liste', () => {
    // Le cas qui compte : sans ça, une carte libérée reste limitée pour toujours
    const current: CardBanRow[] = [{ id: 1, banTcg: 'Limited', banOcg: null }];
    expect(banlistWrites(current, lists())).toEqual([
      { column: 'banTcg', label: null, cardIds: [1] },
    ]);
  });

  it('n’écrit rien quand seul le libellé diffère', () => {
    // « Banned » et « Forbidden » sont le même statut : rien n'a changé pour le joueur
    const current: CardBanRow[] = [{ id: 1, banTcg: 'Forbidden', banOcg: null }];
    expect(banlistWrites(current, lists([entry(1, 'Banned', 'FORBIDDEN')]))).toEqual([]);
  });

  it('ne touche pas une carte déjà au bon statut', () => {
    const current: CardBanRow[] = [{ id: 1, banTcg: 'Limited', banOcg: 'Limited' }];
    const writes = banlistWrites(
      current,
      lists([entry(1, 'Limited', 'LIMITED')], [entry(1, 'Limited', 'LIMITED')]),
    );
    expect(writes).toEqual([]);
  });

  it('traite les deux formats séparément', () => {
    const current: CardBanRow[] = [{ id: 1, banTcg: null, banOcg: 'Banned' }];
    const writes = banlistWrites(
      current,
      lists([entry(1, 'Limited', 'LIMITED')], [entry(1, 'Semi-Limited', 'SEMI_LIMITED')]),
    );
    expect(writes).toEqual([
      { column: 'banTcg', label: 'Limited', cardIds: [1] },
      { column: 'banOcg', label: 'Semi-Limited', cardIds: [1] },
    ]);
  });

  it('groupe les cartes par libellé pour une écriture par groupe', () => {
    const current: CardBanRow[] = [
      { id: 1, banTcg: null, banOcg: null },
      { id: 2, banTcg: null, banOcg: null },
      { id: 3, banTcg: 'Limited', banOcg: null },
    ];
    const writes = banlistWrites(
      current,
      lists([entry(1, 'Banned', 'FORBIDDEN'), entry(2, 'Banned', 'FORBIDDEN')]),
    );
    expect(writes).toEqual([
      { column: 'banTcg', label: 'Banned', cardIds: [1, 2] },
      { column: 'banTcg', label: null, cardIds: [3] },
    ]);
  });

  it('compte un changement par carte et par colonne', () => {
    const current: CardBanRow[] = [{ id: 1, banTcg: null, banOcg: 'Limited' }];
    const writes = banlistWrites(current, lists([entry(1, 'Banned', 'FORBIDDEN')]));
    expect(countChanges(writes)).toBe(2);
  });
});
