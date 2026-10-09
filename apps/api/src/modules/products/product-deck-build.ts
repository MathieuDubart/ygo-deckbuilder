import { DECK_RULES, type ProductKind } from '@ygo/shared';
import type { Candidate } from '../meta-decks/engine/generator';

/** Une ligne de la liste officielle d'un produit, avec de quoi la classer. */
export interface OfficialCard {
  cardId: number;
  /** Exemplaires dans UNE boîte. */
  quantity: number;
  /** Part des listes de tournoi où la carte apparaît, si on la connaît. */
  deckShare?: number | null;
}

/** Nombre de boîtes dont on suppose le montage d'un structure deck. */
export const STRUCTURE_COPIES = 3;

/**
 * Combien d'exemplaires du produit on suppose achetés pour monter son deck.
 *
 * Seul le structure deck se joue en trois boîtes : il est conçu comme une base à compléter,
 * vendu avec un exemplaire de presque tout, et personne ne le joue tel quel. Tous les autres
 * produits à liste — Legendary Decks, coffrets 5D's, decks légendaires — sont au contraire
 * vendus complets : leur liste EST le deck, et la tripler donnerait une chose que personne
 * n'a jamais jouée.
 */
export function copiesFor(kind: ProductKind): number {
  return kind === 'STRUCTURE' ? STRUCTURE_COPIES : 1;
}

/**
 * La liste à monter avec plusieurs boîtes du même produit, dans l'ordre où il faut la garder.
 *
 * Un structure deck est vendu en un exemplaire de presque tout, mais il se joue à trois
 * boîtes : on triple ce qui compte et on coupe le remplissage pour retomber vers quarante
 * cartes. Tout l'intérêt est donc dans l'ORDRE, puisque l'assembleur s'arrête quand le main
 * est plein — ce qui est en tête entre, le reste est coupé.
 *
 * Trois critères, dans cet ordre :
 *  1. le nombre d'exemplaires de la liste d'origine. C'est le signal des concepteurs
 *     eux-mêmes : la carte qu'ils ont mise en trois est le cœur du deck, celle en un seul
 *     exemplaire est là pour remplir ;
 *  2. le taux de jeu en tournoi, quand on le connaît, qui départage les cartes à égalité ;
 *  3. l'identifiant, pour que deux montages du même produit donnent exactement la même liste.
 *
 * Les limites — trois exemplaires, banlist, taille des zones — ne sont PAS appliquées ici :
 * c'est le travail de l'assembleur, qui les connaît déjà et les applique à tout le monde.
 */
export function officialCandidates(cards: OfficialCard[], copies: number): Candidate[] {
  return [...cards]
    .sort(
      (a, b) =>
        b.quantity - a.quantity ||
        (b.deckShare ?? 0) - (a.deckShare ?? 0) ||
        a.cardId - b.cardId,
    )
    .map((c) => ({
      cardId: c.cardId,
      want: Math.min(DECK_RULES.MAX_COPIES, c.quantity * Math.max(1, copies)),
      source: 'CORE' as const,
      // Montré dans le deck généré : d'où vient cette carte, et à quel point elle est centrale
      inclusion: Math.min(1, c.quantity / DECK_RULES.MAX_COPIES),
    }));
}

/**
 * Taille visée du main deck. Avec une seule boîte on reproduit la liste telle qu'elle est
 * vendue — souvent quarante et quelques cartes, et la tronquer donnerait un deck que personne
 * n'a jamais vu. Au-delà, on vise le minimum légal : c'est la coupe qui fait le montage.
 */
export function mainTargetFor(cards: OfficialCard[], copies: number): number {
  const official = cards.reduce((sum, c) => sum + c.quantity, 0);
  return copies > 1 ? DECK_RULES.MAIN.min : Math.max(DECK_RULES.MAIN.min, official);
}
