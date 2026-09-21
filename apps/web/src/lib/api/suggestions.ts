'use client';
import { useQuery } from '@tanstack/react-query';
import type { ArchetypeSuggestionDto, MetaDeckSuggestionDto } from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export const useMetaSuggestions = () =>
  useQuery({
    queryKey: qk.metaSuggestions,
    queryFn: () =>
      api<MetaDeckSuggestionDto[]>('/suggestions/meta-decks', { query: { limit: 20 } }),
  });

export const useArchetypeSuggestions = () =>
  useQuery({
    queryKey: qk.archetypeSuggestions,
    queryFn: () => api<ArchetypeSuggestionDto[]>('/suggestions/archetypes'),
  });
