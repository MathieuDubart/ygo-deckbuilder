'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CardSuggestionDto,
  CreateDeckInput,
  DeckDto,
  DeckListItemDto,
  DeckQueryInput,
  DeckStrengthDto,
  ImportYdkInput,
  UpdateDeckInput,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export type DeckParams = Partial<Omit<DeckQueryInput, 'tagIds'>> & { tagIds?: string[] };

export const useDecks = (params: DeckParams = {}) =>
  useQuery({
    queryKey: qk.deckList(params),
    queryFn: () =>
      api<DeckListItemDto[]>('/decks', {
        // Les étiquettes voyagent en liste séparée par des virgules, comme pour la collection
        query: { ...params, tagIds: params.tagIds?.length ? params.tagIds.join(',') : undefined },
      }),
    placeholderData: keepPreviousData,
  });

export const useDeck = (id: string) =>
  useQuery({ queryKey: qk.deck(id), queryFn: () => api<DeckDto>(`/decks/${id}`) });

/** Note, forme et pronostics. À part de la fiche : c'est le calcul le plus lourd. */
export const useDeckStrength = (id: string) =>
  useQuery({
    queryKey: qk.deckStrength(id),
    queryFn: () => api<DeckStrengthDto | null>(`/decks/${id}/strength`),
  });

export const useDeckCardSuggestions = (deckId: string) =>
  useQuery({
    queryKey: qk.deckSuggestions(deckId),
    queryFn: () => api<CardSuggestionDto[]>(`/suggestions/decks/${deckId}/cards`),
  });

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateDeckInput> & { name: string }) =>
      api<DeckDto>('/decks', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  });
}

export function useImportYdk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ImportYdkInput> & { name: string; content: string }) =>
      api<DeckDto>('/decks/import-ydk', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  });
}

export function useUpdateDeck(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDeckInput) => api<DeckDto>(`/decks/${id}`, { method: 'PATCH', body }),
    onSuccess: (deck) => {
      qc.setQueryData(qk.deck(id), deck);
      void qc.invalidateQueries({ queryKey: qk.decks });
      void qc.invalidateQueries({ queryKey: qk.deckSuggestions(id) });
    },
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/decks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  });
}

export function useDuplicateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<DeckDto>(`/decks/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decks }),
  });
}
