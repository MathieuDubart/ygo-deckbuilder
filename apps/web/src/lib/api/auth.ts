'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PublicUser, RegisterInput } from '@ygo/shared';
import { useRouter } from 'next/navigation';
import { api } from './client';
import { qk } from './keys';

export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: () => api<PublicUser>('/auth/me'), staleTime: 5 * 60_000 });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginInput) =>
      api<PublicUser>('/auth/login', { method: 'POST', body, skipRefresh: true }),
    onSuccess: (user) => qc.setQueryData(qk.me, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterInput) =>
      api<PublicUser>('/auth/register', { method: 'POST', body, skipRefresh: true }),
    onSuccess: (user) => qc.setQueryData(qk.me, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST', skipRefresh: true }),
    onSettled: () => {
      qc.clear();
      router.replace('/login');
    },
  });
}
