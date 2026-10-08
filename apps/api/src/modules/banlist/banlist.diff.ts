import { banStatusOf } from '@ygo/shared';
import type { BanlistEntry } from './banlist.parser';

/** Les deux colonnes de statut d'une carte. */
export type BanColumn = 'banTcg' | 'banOcg';

/** Statut d'une carte en base, tel qu'on le lit avant de décider quoi écrire. */
export interface CardBanRow {
  id: number;
  banTcg: string | null;
  banOcg: string | null;
}

/** Une écriture groupée : ce libellé, sur ces cartes, dans cette colonne. */
export interface BanlistWrite {
  column: BanColumn;
  /** `null` efface le statut : la carte est sortie de la banlist. */
  label: string | null;
  cardIds: number[];
}

/**
 * Ce qu'il faut écrire pour que la base dise la même chose que les listes reçues.
 *
 * Le piège de cette fonction est ce qu'elle doit RETIRER. Une banlist se lit comme la liste
 * exhaustive de ce qui est restreint : une carte qui n'y figure plus redevient jouable en trois
 * exemplaires. Ne traiter que les cartes reçues laisserait les sorties de liste limitées à
 * jamais — et c'est justement ce qu'on vient chercher en relisant la liste souvent.
 *
 * La comparaison porte sur le statut normalisé, pas sur le libellé : la source peut écrire
 * « Banned » là où on avait stocké « Forbidden » sans que rien n'ait changé pour le joueur, et
 * réécrire la base à chaque relecture ferait croire à un changement.
 */
export function banlistWrites(
  current: CardBanRow[],
  listed: Record<BanColumn, Map<number, BanlistEntry>>,
): BanlistWrite[] {
  const grouped: Record<BanColumn, Map<string | null, number[]>> = {
    banTcg: new Map(),
    banOcg: new Map(),
  };

  for (const card of current) {
    for (const column of ['banTcg', 'banOcg'] as const) {
      const next = listed[column].get(card.id) ?? null;
      if (banStatusOf(card[column]) === (next?.status ?? null)) continue;
      const label = next?.label ?? null;
      const ids = grouped[column].get(label) ?? [];
      ids.push(card.id);
      grouped[column].set(label, ids);
    }
  }

  return (['banTcg', 'banOcg'] as const).flatMap((column) =>
    [...grouped[column]].map(([label, cardIds]) => ({ column, label, cardIds })),
  );
}

/** Nombre de statuts qui bougent — ce que le client lit pour savoir s'il doit recharger. */
export const countChanges = (writes: BanlistWrite[]): number =>
  writes.reduce((sum, w) => sum + w.cardIds.length, 0);

export const indexByCard = (entries: BanlistEntry[]): Map<number, BanlistEntry> =>
  new Map(entries.map((e) => [e.cardId, e]));
