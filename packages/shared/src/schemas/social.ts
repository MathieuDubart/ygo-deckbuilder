import { z } from 'zod';
import type { CardSummaryDto } from './cards';

/**
 * Profils et amitiés. Deux personnes amies voient le profil de l'autre et son avancement par
 * extension — rien de plus : la collection complète d'un ami n'est pas consultable.
 */

/**
 * Le pseudo sert à se trouver et à s'ajouter : il est donc visible par d'autres comptes, et
 * unique sans distinction de casse (la base pose l'index sur `lower(username)`). Jamais
 * d'espace, pour qu'il reste recopiable à la main sans ambiguïté.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
    'Lettres, chiffres, point, tiret et souligné ; commence par une lettre ou un chiffre',
  );

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Au-delà de deux caractères seulement : une lettre seule listerait la moitié des comptes. */
export const userSearchSchema = z.object({
  q: z.string().trim().min(2).max(20),
});
export type UserSearchInput = z.infer<typeof userSearchSchema>;

export const friendRequestSchema = z.object({
  username: usernameSchema,
});
export type FriendRequestInput = z.infer<typeof friendRequestSchema>;

/**
 * Cartes mises en avant sur le profil, dans l'ordre reçu. On envoie la liste entière plutôt
 * qu'un ajout : réordonner est alors la même opération, et le client n'a rien à réconcilier.
 */
export const MAX_PROFILE_CARDS = 12;
export const profileCardsSchema = z.object({
  printIds: z.array(z.string().min(1).max(40)).max(MAX_PROFILE_CARDS),
});
export type ProfileCardsInput = z.infer<typeof profileCardsSchema>;

/** Images de profil : réencodées en WebP par le serveur, d'où une taille d'entrée généreuse. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const PROFILE_IMAGE_KINDS = ['avatar', 'banner'] as const;
export type ProfileImageKind = (typeof PROFILE_IMAGE_KINDS)[number];

/** Un compte vu de l'extérieur : jamais l'e-mail, qui n'est pas une donnée sociale. */
export interface PublicUserDto {
  id: string;
  username: string;
  /** Chemin servi par l'API (`/uploads/…`), ou null. */
  avatarUrl: string | null;
  bannerUrl: string | null;
}

export const FRIENDSHIP_STATES = [
  'SELF',
  'NONE',
  'FRIENDS',
  'REQUEST_SENT',
  'REQUEST_RECEIVED',
] as const;
export type FriendshipState = (typeof FRIENDSHIP_STATES)[number];

export interface UserSearchResultDto extends PublicUserDto {
  state: FriendshipState;
  /** Demande en cours, pour l'accepter ou l'annuler sans la rechercher. */
  requestId: string | null;
}

export interface FriendRequestDto {
  id: string;
  /** L'autre personne, jamais soi-même. */
  user: PublicUserDto;
  direction: 'INCOMING' | 'OUTGOING';
  createdAt: string;
}

/** Repères de collection partagés entre amis (pas la collection elle-même). */
export interface SocialStatsDto {
  distinctCards: number;
  copies: number;
  /** Extensions dont au moins une carte est possédée. */
  sets: number;
  /** Extensions complètes, à l'impression près. */
  completedSets: number;
}

export interface FriendDto extends PublicUserDto {
  friendsSince: string;
  stats: SocialStatsDto;
}

/** Une carte mise en avant : l'impression possédée, pas seulement la carte. */
export interface ProfileCardDto {
  printId: string;
  printCode: string;
  rarity: string;
  setName: string;
  card: CardSummaryDto;
}

export interface ProfileDto {
  user: PublicUserDto;
  state: FriendshipState;
  /** Date depuis laquelle on est amis, null si ce n'est pas le cas (profil propre inclus). */
  friendsSince: string | null;
  friendCount: number;
  stats: SocialStatsDto;
  cards: ProfileCardDto[];
  memberSince: string;
}

/**
 * Un profil qu'on n'a pas le droit de voir renvoie quand même de quoi demander la personne en
 * ami : son pseudo et son avatar, que la recherche montre déjà. L'union force le client à
 * traiter le cas plutôt qu'à lire des compteurs à zéro comme si c'était la réalité.
 */
export type ProfileViewDto =
  | ({ visible: true } & ProfileDto)
  | {
      visible: false;
      user: PublicUserDto;
      state: FriendshipState;
      requestId: string | null;
    };

/** Avancement d'un ami sur une extension, dans les deux lectures habituelles. */
export interface FriendSetProgressDto {
  user: PublicUserDto;
  prints: number;
  cards: number;
  ownedPrints: number;
  ownedCards: number;
}

/**
 * Qui possède quoi dans une extension. `owners` est indexé par impression plutôt que par ami :
 * la grille de la fiche se lit carte par carte, et une impression n'a qu'une poignée de
 * propriétaires alors qu'un ami peut en posséder des centaines.
 */
export interface SetFriendsDto {
  friends: FriendSetProgressDto[];
  /** printId → identifiants d'amis qui possèdent cette impression exacte. */
  owners: Record<string, string[]>;
  /** printId → identifiants d'amis qui possèdent la carte dans une autre édition. */
  ownersAnyEdition: Record<string, string[]>;
}

/** Avancement des amis sur plusieurs extensions à la fois (liste des extensions). */
export type FriendsProgressDto = Record<string, FriendSetProgressDto[]>;

export const setIdsSchema = z.object({
  setIds: z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(','))
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .pipe(z.array(z.string().max(40)).max(60)),
});
export type SetIdsInput = z.infer<typeof setIdsSchema>;
