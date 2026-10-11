import { z } from 'zod';
import { paginationSchema } from './pagination';

/**
 * Panneau d'administration d'une instance.
 *
 * Le projet est fait pour être auto-hébergé : celui qui tient le serveur est souvent seul à
 * le tenir, et ce qu'il lui faut n'est pas un back-office de SaaS mais de quoi répondre à
 * trois questions — qui a un compte, est-ce que les synchros tournent, est-ce que la machine
 * va bien. Tout le reste s'administre très bien en SSH.
 */

export const adminUsersQuerySchema = paginationSchema.extend({
  /** Cherche dans le pseudo ET l'email : l'admin a souvent l'un ou l'autre en tête. */
  q: z.string().trim().max(100).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  sort: z.enum(['recent', 'name', 'cards', 'decks']).optional(),
});
export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;

export const setUserRoleSchema = z.object({ role: z.enum(['USER', 'ADMIN']) });
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

export interface AdminUserDto {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  avatarUrl: string | null;
  /** Exemplaires en collection, toutes cartes confondues. */
  copies: number;
  distinctCards: number;
  decks: number;
  products: number;
  /** Dernière session ouverte, d'après les jetons de rafraîchissement encore en base. */
  lastSeenAt: string | null;
  /**
   * Ce compte tient son rôle d'`ADMIN_EMAIL` : le lui retirer ne servirait à rien, il le
   * reprendrait à sa prochaine connexion. L'interface le dit plutôt que de laisser
   * l'action échouer.
   */
  pinnedByEnv: boolean;
}

/** Une synchronisation, telle que la table d'état la décrit. */
export interface AdminSyncDto {
  id: string;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  /** Ce que la synchro compte : des cartes, des listes, des decks selon le cas. */
  count: number;
  databaseVersion: string | null;
  /** Le panneau sait la relancer. Les autres lignes sont des états internes, en lecture seule. */
  runnable: boolean;
}

export interface AdminCountsDto {
  users: number;
  cards: number;
  prints: number;
  sets: number;
  collectionItems: number;
  copies: number;
  decks: number;
  products: number;
  /** Taille du dossier d'images de profil, le seul état hors base. */
  uploadsBytes: number;
}

export interface AdminHealthDto {
  database: boolean;
  /** Le dossier d'uploads existe et accepte l'écriture. */
  uploadsWritable: boolean;
  /** Données du simulateur : prêtes, absentes, ou simulateur désactivé. */
  duelData: 'READY' | 'MISSING' | 'DISABLED';
  nodeVersion: string;
  uptimeSeconds: number;
}

export interface AdminOverviewDto {
  counts: AdminCountsDto;
  health: AdminHealthDto;
  syncs: AdminSyncDto[];
}

/** Synchros que le panneau sait relancer, et leur ordre d'affichage. */
export const ADMIN_RUNNABLE_SYNCS = [
  'ygoprodeck',
  'ygoprodeck-banlist',
  'meta',
  'yugipedia-upcoming',
] as const;
export type AdminRunnableSync = (typeof ADMIN_RUNNABLE_SYNCS)[number];
