'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  Paginated,
  ReleaseDetailDto,
  ReleaseDto,
  ReleaseFacetsDto,
  ReleaseQueryInput,
  ReleaseSpotlightDto,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export type ReleaseParams = Partial<Omit<ReleaseQueryInput, 'tagIds'>> & { tagIds?: string[] };

/** Les étiquettes voyagent en liste séparée par des virgules. */
const toQuery = (params: ReleaseParams) => ({
  ...params,
  tagIds: params.tagIds?.length ? params.tagIds.join(',') : undefined,
});

export const useReleases = (params: ReleaseParams) =>
  useQuery({
    queryKey: qk.releases(params),
    queryFn: () => api<Paginated<ReleaseDto>>('/collection/releases', { query: toQuery(params) }),
    placeholderData: keepPreviousData,
  });

/** Ce qui arrive et ce qui vient de sortir, mis en avant en haut de l'onglet. */
export const useReleaseSpotlight = () =>
  useQuery({
    queryKey: qk.releaseSpotlight,
    queryFn: () => api<ReleaseSpotlightDto>('/collection/releases/spotlight'),
  });

export const useReleaseFacets = () =>
  useQuery({
    queryKey: qk.releaseFacets,
    queryFn: () => api<ReleaseFacetsDto>('/collection/releases/facets'),
  });

export const useRelease = (setId: string | null) =>
  useQuery({
    queryKey: qk.release(setId ?? ''),
    queryFn: () => api<ReleaseDetailDto>(`/collection/releases/${setId}`),
    enabled: setId !== null,
  });
