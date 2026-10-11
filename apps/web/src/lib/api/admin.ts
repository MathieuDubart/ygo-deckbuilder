'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminOverviewDto,
  AdminRunnableSync,
  AdminUserDto,
  AdminUsersQueryInput,
  Paginated,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export type AdminUsersParams = Partial<AdminUsersQueryInput>;

export const useAdminOverview = () =>
  useQuery({
    queryKey: qk.adminOverview,
    queryFn: () => api<AdminOverviewDto>('/admin/overview'),
  });

export const useAdminUsers = (params: AdminUsersParams) =>
  useQuery({
    queryKey: qk.adminUsers(params),
    queryFn: () => api<Paginated<AdminUserDto>>('/admin/users', { query: params }),
    placeholderData: keepPreviousData,
  });

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'USER' | 'ADMIN' }) =>
      api<AdminUserDto>(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.admin }),
  });
}

/**
 * Relance une synchro. Certaines durent plusieurs minutes et la réponse n'arrive qu'à la
 * fin : c'est le bouton qui doit le dire, pas l'utilisateur qui doit le deviner.
 */
export function useRunSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: AdminRunnableSync) =>
      api<void>(`/admin/syncs/${id}/run`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.admin }),
  });
}
