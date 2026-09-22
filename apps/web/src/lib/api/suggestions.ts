'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ArchetypeSuggestionDto,
  GeneratedDeckDto,
  GenerationMode,
  MetaDeckSuggestionDto,
  PlayableDeckDto,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export const useMetaSuggestions = () =>
  useQuery({
    queryKey: qk.metaSuggestions,
    queryFn: () =>
      api<MetaDeckSuggestionDto[]>('/suggestions/meta-decks', { query: { limit: 30 } }),
  });

export const useArchetypeSuggestions = () =>
  useQuery({
    queryKey: qk.archetypeSuggestions,
    queryFn: () => api<ArchetypeSuggestionDto[]>('/suggestions/archetypes'),
  });

/** Decks complets et jouables avec la collection (calcul côté API, ~1 s). */
export const usePlayableDecks = () =>
  useQuery({
    queryKey: qk.playable,
    queryFn: () => api<PlayableDeckDto[]>('/suggestions/playable'),
    staleTime: 5 * 60_000,
  });

/** Ce qu'on veut générer : un archétype du meta (avec un mode) ou un archétype de la collection. */
export type GenerationTarget =
  { kind: 'meta'; metaDeckId: string; name: string } | { kind: 'archetype'; archetype: string };

export const useGeneratedDeck = (target: GenerationTarget | null, mode: GenerationMode) =>
  useQuery({
    queryKey: qk.generated(target, mode),
    queryFn: () =>
      target!.kind === 'meta'
        ? api<GeneratedDeckDto>(`/suggestions/generate/meta/${target!.metaDeckId}`, {
            query: { mode },
          })
        : api<GeneratedDeckDto>('/suggestions/generate/archetype', {
            query: { archetype: target!.archetype },
          }),
    enabled: target !== null,
    placeholderData: keepPreviousData,
  });

export interface MetaStatus {
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  cardCount: number;
}

export const useMetaStatus = () =>
  useQuery({
    queryKey: qk.metaStatus,
    queryFn: () => api<MetaStatus | null>('/meta-decks/status'),
  });

export function useMetaSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ fetched: number; lists: number; archetypes: number; staples: number }>(
        '/meta-decks/sync',
        { method: 'POST' },
      ),
    onSuccess: () =>
      Promise.all(
        [qk.metaStatus, ['suggestions']].map((queryKey) => qc.invalidateQueries({ queryKey })),
      ),
  });
}
