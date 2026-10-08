import { banStatusOf, type BanStatus } from '@ygo/shared';
import type { YgoCard } from '../catalog-sync/ygoprodeck.types';

/** Les deux listes qu'on suit. Le format d'un deck dit laquelle s'applique. */
export type BanlistFormat = 'tcg' | 'ocg';

/** Statut d'une carte, tel qu'on le garde en base (libellé brut) et tel qu'on le compare. */
export interface BanlistEntry {
  cardId: number;
  /** Libellé brut de la source, stocké tel quel — c'est ce que l'interface affiche. */
  label: string;
  status: BanStatus;
}

/**
 * Lit une réponse `cardinfo.php?banlist=<format>`. On ne garde que ce qui porte un statut
 * reconnu pour LE format demandé : la réponse décrit aussi l'autre liste, et une carte peut
 * être interdite d'un côté et libre de l'autre — la recopier à l'aveugle les mélangerait.
 *
 * Les doublons sont écartés (une carte revient si la réponse est paginée côté source), et un
 * libellé inconnu est ignoré plutôt que traité comme une interdiction : se tromper ici
 * effacerait une carte des decks de tout le monde.
 */
export function parseBanlist(cards: YgoCard[], format: BanlistFormat): BanlistEntry[] {
  const byId = new Map<number, BanlistEntry>();
  for (const card of cards) {
    if (typeof card.id !== 'number') continue;
    const label = format === 'tcg' ? card.banlist_info?.ban_tcg : card.banlist_info?.ban_ocg;
    const status = banStatusOf(label);
    if (!label || !status) continue;
    byId.set(card.id, { cardId: card.id, label, status });
  }
  return [...byId.values()];
}
