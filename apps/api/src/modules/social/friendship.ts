import type { FriendshipState } from '@ygo/shared';

/**
 * Lecture d'une relation. Logique pure : une seule ligne en base porte les deux sens, donc
 * l'état dépend de qui regarde — et c'est exactement le genre de détail qu'on inverse un jour
 * sans le voir. D'où des tests plutôt qu'un ternaire au milieu d'un service.
 */

export interface FriendshipRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'PENDING' | 'ACCEPTED';
}

export interface Relation {
  state: FriendshipState;
  /** Demande en cours, pour l'accepter ou l'annuler sans la rechercher. */
  requestId: string | null;
}

export function relationTo(
  viewerId: string,
  otherId: string,
  row: FriendshipRow | null | undefined,
): Relation {
  if (viewerId === otherId) return { state: 'SELF', requestId: null };
  if (!row) return { state: 'NONE', requestId: null };
  if (row.status === 'ACCEPTED') return { state: 'FRIENDS', requestId: null };
  const sent = row.requesterId === viewerId;
  return { state: sent ? 'REQUEST_SENT' : 'REQUEST_RECEIVED', requestId: row.id };
}

/** L'autre personne de la relation, vue par `viewerId`. */
export function otherSide(viewerId: string, row: FriendshipRow): string {
  return row.requesterId === viewerId ? row.addresseeId : row.requesterId;
}

/** Une relation acceptée donne accès au profil et à l'avancement par extension. */
export function canSeeProfile(relation: Relation): boolean {
  return relation.state === 'SELF' || relation.state === 'FRIENDS';
}
