'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FriendDto,
  FriendRequestDto,
  FriendsProgressDto,
  ProfileCardDto,
  ProfileImageKind,
  ProfileViewDto,
  SetFriendsDto,
  UpdateProfileInput,
  UserSearchResultDto,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

/**
 * Les images de profil sont servies par l'API, donc derrière le proxy `/api` : le chemin
 * renvoyé est relatif à l'API, pas au front. Une seule fonction le préfixe, pour qu'aucune
 * vue ne le fasse à sa façon.
 */
export const imageUrl = (path: string | null | undefined): string | null =>
  path ? `/api${path}` : null;

export const useProfile = (username?: string) =>
  useQuery({
    queryKey: username ? qk.profile(username) : qk.myProfile,
    queryFn: () =>
      api<ProfileViewDto>(
        username ? `/users/${encodeURIComponent(username)}/profile` : '/me/profile',
      ),
  });

export const useFriends = () =>
  useQuery({ queryKey: qk.friends, queryFn: () => api<FriendDto[]>('/friends') });

export const useFriendRequests = () =>
  useQuery({
    queryKey: qk.friendRequests,
    queryFn: () => api<FriendRequestDto[]>('/friends/requests'),
  });

/** Recherche de comptes. Deux caractères minimum, c'est la règle du serveur. */
export const useUserSearch = (q: string) =>
  useQuery({
    queryKey: qk.userSearch(q),
    queryFn: () => api<UserSearchResultDto[]>('/users/search', { query: { q } }),
    enabled: q.trim().length >= 2,
  });

/**
 * Avancement des amis sur les extensions affichées. Une seule requête par page de liste
 * plutôt qu'une par ligne, et rien du tout si on n'a pas d'ami.
 */
export const useFriendsProgress = (setIds: string[]) =>
  useQuery({
    queryKey: qk.friendsProgress(setIds),
    queryFn: () =>
      api<FriendsProgressDto>('/friends/releases', { query: { setIds: setIds.join(',') } }),
    enabled: setIds.length > 0,
    // L'avancement d'un ami ne change pas pendant qu'on regarde la page
    staleTime: 60_000,
  });

export const useSetFriends = (setId: string | null) =>
  useQuery({
    queryKey: qk.setFriends(setId ?? ''),
    queryFn: () => api<SetFriendsDto>(`/friends/releases/${setId}`),
    enabled: !!setId,
    staleTime: 60_000,
  });

/** Tout ce qui touche à une relation change les listes, les demandes et les profils. */
function useInvalidateSocial() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [
        qk.friends,
        qk.friendRequests,
        ['user-search'],
        ['profile'],
        qk.myProfile,
        ['friends-progress'],
        ['set-friends'],
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
}

export function useRequestFriend() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: (username: string) =>
      api<UserSearchResultDto>('/friends/requests', { method: 'POST', body: { username } }),
    onSuccess: invalidate,
  });
}

export function useRespondToRequest() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api<void>(`/friends/requests/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/** Retire l'ami ou annule la demande envoyée : c'est la même route. */
export function useRemoveFriend() {
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/friends/${userId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => api<void>('/me/profile', { method: 'PATCH', body }),
    onSuccess: () =>
      Promise.all(
        [qk.myProfile, qk.me, ['profile']].map((queryKey) => qc.invalidateQueries({ queryKey })),
      ),
  });
}

export function useSetProfileCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (printIds: string[]) =>
      api<ProfileCardDto[]>('/me/profile/cards', { method: 'PUT', body: { printIds } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myProfile }),
  });
}

/**
 * Envoi d'une image. `fetch` sans `Content-Type` : le navigateur doit poser lui-même la
 * frontière du multipart, et le client JSON de la maison ne sait pas faire ça.
 */
export function useUploadProfileImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, file }: { kind: ProfileImageKind; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/me/profile/${kind}`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? res.statusText);
      }
      return (await res.json()) as { url: string };
    },
    onSuccess: () =>
      Promise.all(
        [qk.myProfile, ['profile'], qk.friends].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

export function useRemoveProfileImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ProfileImageKind) => api<void>(`/me/profile/${kind}`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all(
        [qk.myProfile, ['profile'], qk.friends].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
