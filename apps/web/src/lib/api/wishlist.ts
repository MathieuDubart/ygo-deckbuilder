'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddWishlistItemInput, CardSummaryDto, UpdateWishlistItemInput } from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export interface WishlistItemDto {
  id: string;
  quantity: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  language: string | null;
  maxPrice: number | null;
  notes: string | null;
  card: CardSummaryDto;
  print: {
    id: string;
    printCode: string;
    rarity: string;
    setName: string;
    price: number | null;
  } | null;
  deck: { id: string; name: string } | null;
  unitPrice: number | null;
}

export const useWishlist = () =>
  useQuery({
    queryKey: qk.wishlist,
    queryFn: () => api<{ items: WishlistItemDto[]; totalEstimated: number }>('/wishlist'),
  });

export function useAddToWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AddWishlistItemInput> & { cardId: number }) =>
      api<WishlistItemDto>('/wishlist', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wishlist }),
  });
}

export function useUpdateWishlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateWishlistItemInput & { id: string }) =>
      api<WishlistItemDto>(`/wishlist/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wishlist }),
  });
}

export function useRemoveWishlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/wishlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wishlist }),
  });
}

export function useMarkAcquired() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/wishlist/${id}/acquired`, { method: 'POST' }),
    onSuccess: () =>
      Promise.all(
        [qk.wishlist, qk.collectionAll, qk.collectionStats, ['suggestions'], ['deck']].map(
          (queryKey) => qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
