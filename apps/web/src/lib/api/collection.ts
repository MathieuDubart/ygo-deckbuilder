'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddCollectionItemInput,
  CardSummaryDto,
  CollectionQueryInput,
  ImportSetInput,
  ImportSetResultDto,
  OwnedProductDetailDto,
  OwnedProductDto,
  Paginated,
  UpdateCollectionItemInput,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export interface CollectionItemDto {
  id: string;
  quantity: number;
  condition: string;
  language: string;
  firstEdition: boolean;
  notes: string | null;
  card: CardSummaryDto;
  print: {
    id: string;
    printCode: string;
    rarity: string;
    setName: string;
    price: number | null;
  } | null;
}

export interface CollectionStats {
  totalCopies: number;
  distinctCards: number;
  estimatedValue: number;
}

export const useCollection = (params: Partial<CollectionQueryInput>) =>
  useQuery({
    queryKey: qk.collection(params),
    queryFn: () => api<Paginated<CollectionItemDto>>('/collection', { query: params }),
    placeholderData: keepPreviousData,
  });

export const useCollectionStats = () =>
  useQuery({
    queryKey: qk.collectionStats,
    queryFn: () => api<CollectionStats>('/collection/stats'),
  });

/** Toute modif de collection impacte : quantités affichées, stats, decks, suggestions. */
function useInvalidateOwnership() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [
        qk.collectionAll,
        qk.collectionStats,
        qk.products,
        ['cards'],
        ['card'],
        ['deck'],
        ['suggestions'],
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
}

export function useAddToCollection() {
  const invalidate = useInvalidateOwnership();
  return useMutation({
    mutationFn: (body: Partial<AddCollectionItemInput> & { cardId: number }) =>
      api<CollectionItemDto>('/collection', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateCollectionItem() {
  const invalidate = useInvalidateOwnership();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateCollectionItemInput & { id: string }) =>
      api<CollectionItemDto | null>(`/collection/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useRemoveCollectionItem() {
  const invalidate = useInvalidateOwnership();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/collection/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useImportSet() {
  const invalidate = useInvalidateOwnership();
  return useMutation({
    mutationFn: (body: Partial<ImportSetInput> & { setName: string }) =>
      api<ImportSetResultDto>('/collection/import-set', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useRemoveProduct() {
  const qc = useQueryClient();
  const invalidate = useInvalidateOwnership();
  return useMutation({
    mutationFn: ({ id, removeCards }: { id: string; removeCards: boolean }) =>
      api<void>(`/collection/products/${id}`, {
        method: 'DELETE',
        query: { removeCards: String(removeCards) },
      }),
    // La fiche du produit supprimé ne doit pas être rechargée (404)
    onSuccess: (_, { id }) => {
      qc.removeQueries({ queryKey: qk.product(id) });
      return invalidate();
    },
  });
}

/** Produits ajoutés à la collection (structure decks, tins…). */
export const useOwnedProducts = () =>
  useQuery({
    queryKey: qk.products,
    queryFn: () => api<OwnedProductDto[]>('/collection/products'),
  });

export const useOwnedProduct = (id: string | null) =>
  useQuery({
    queryKey: qk.product(id ?? ''),
    queryFn: () => api<OwnedProductDetailDto>(`/collection/products/${id}`),
    enabled: id !== null,
  });
