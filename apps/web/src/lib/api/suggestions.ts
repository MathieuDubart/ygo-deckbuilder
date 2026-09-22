'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ArchetypeSuggestionDto,
  GeneratedDeckDto,
  GenerationMode,
  MetaDeckSuggestionDto,
  OfficialDeckKind,
  OfficialDeckSuggestionDto,
  PlayableDeckDto,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export type { OfficialDeckKind };

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
  | { kind: 'meta'; metaDeckId: string; name: string }
  | { kind: 'official'; productDeckId: string; name: string }
  | { kind: 'archetype'; archetype: string };

/** Decks officiels (structure decks, starters, coffrets) et leur couverture par la collection. */
export const useOfficialDecks = (kind?: OfficialDeckKind) =>
  useQuery({
    queryKey: qk.officialDecks(kind ?? 'ALL'),
    queryFn: () =>
      api<OfficialDeckSuggestionDto[]>('/suggestions/official-decks', {
        query: { kind, limit: 60 },
      }),
    placeholderData: keepPreviousData,
  });

function generatedDeckRequest(target: GenerationTarget, mode: GenerationMode) {
  switch (target.kind) {
    case 'meta':
      return api<GeneratedDeckDto>(`/suggestions/generate/meta/${target.metaDeckId}`, {
        query: { mode },
      });
    case 'official':
      return api<GeneratedDeckDto>(`/suggestions/generate/official/${target.productDeckId}`, {
        query: { mode },
      });
    case 'archetype':
      return api<GeneratedDeckDto>('/suggestions/generate/archetype', {
        query: { archetype: target.archetype },
      });
  }
}

export const useGeneratedDeck = (target: GenerationTarget | null, mode: GenerationMode) =>
  useQuery({
    queryKey: qk.generated(target, mode),
    queryFn: () => generatedDeckRequest(target!, mode),
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
