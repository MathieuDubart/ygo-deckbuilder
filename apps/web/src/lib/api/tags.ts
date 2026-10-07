'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTagInput, TagDto, UpdateTagInput } from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export const useTags = () => useQuery({ queryKey: qk.tags, queryFn: () => api<TagDto[]>('/tags') });

/** Poser ou retirer une étiquette change ce que les listes filtrées renvoient. */
function useInvalidateTagged() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [qk.tags, qk.collectionAll, qk.productsAll, qk.releasesAll, ['cards'], ['card']].map(
        (queryKey) => qc.invalidateQueries({ queryKey }),
      ),
    );
}

export function useCreateTag() {
  const invalidate = useInvalidateTagged();
  return useMutation({
    mutationFn: (body: CreateTagInput) => api<TagDto>('/tags', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateTag() {
  const invalidate = useInvalidateTagged();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTagInput & { id: string }) =>
      api<TagDto>(`/tags/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteTag() {
  const invalidate = useInvalidateTagged();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Pose (`on`) ou retire l'étiquette d'une carte. */
export function useTagCard() {
  const invalidate = useInvalidateTagged();
  return useMutation({
    mutationFn: ({ tagId, cardId, on }: { tagId: string; cardId: number; on: boolean }) =>
      api<TagDto>(`/tags/${tagId}/cards/${cardId}`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Pose ou retire l'étiquette d'une extension (produit possédé ou non). */
export function useTagSet() {
  const invalidate = useInvalidateTagged();
  return useMutation({
    mutationFn: ({ tagId, setId, on }: { tagId: string; setId: string; on: boolean }) =>
      api<TagDto>(`/tags/${tagId}/sets/${setId}`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: invalidate,
  });
}
