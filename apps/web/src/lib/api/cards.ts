'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  CardDetailDto,
  CardInteractionsDto,
  CardSearchInput,
  CardSetDto,
  CardSummaryDto,
  Paginated,
  SetSearchInput,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export type CardSearchParams = Partial<CardSearchInput>;

export const useCardSearch = (params: CardSearchParams, enabled = true) =>
  useQuery({
    queryKey: qk.cards(params),
    queryFn: () => api<Paginated<CardSummaryDto>>('/cards', { query: params }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useCard = (id: number | null) =>
  useQuery({
    queryKey: qk.card(id ?? 0),
    queryFn: () => api<CardDetailDto>(`/cards/${id}`),
    enabled: id !== null,
  });

/** Interactions de la carte avec le reste du catalogue (index calculé côté API). */
export const useCardInteractions = (id: number | null) =>
  useQuery({
    queryKey: qk.cardInteractions(id ?? 0),
    queryFn: () => api<CardInteractionsDto>(`/cards/${id}/interactions`),
    enabled: id !== null,
    staleTime: 5 * 60_000,
  });

export const useArchetypes = () =>
  useQuery({
    queryKey: qk.archetypes,
    queryFn: () => api<string[]>('/cards/archetypes'),
    staleTime: Infinity,
  });

export const useSets = (params: SetSearchInput) =>
  useQuery({
    queryKey: qk.sets(params),
    queryFn: () => api<CardSetDto[]>('/cards/sets', { query: { ...params } }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
