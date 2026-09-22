'use client';
import { useQuery } from '@tanstack/react-query';
import type {
  CreateDuelInput,
  DuelEngineStatusDto,
  DuelResponseInput,
  DuelSettingsInput,
  DuelStateDto,
} from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

/** Données du moteur (cartes + scripts) : on revérifie tant qu'elles se téléchargent. */
export const useDuelEngine = () =>
  useQuery({
    queryKey: qk.duelEngine,
    queryFn: () => api<DuelEngineStatusDto>('/duels/engine'),
    refetchInterval: (q) => (q.state.data && !q.state.data.ready ? 5_000 : false),
  });

export const duelApi = {
  create: (body: CreateDuelInput) => api<DuelStateDto>('/duels', { method: 'POST', body }),
  get: (id: string) => api<DuelStateDto>(`/duels/${id}`),
  respond: (id: string, body: DuelResponseInput) =>
    api<DuelStateDto>(`/duels/${id}/respond`, { method: 'POST', body }),
  settings: (id: string, body: DuelSettingsInput) =>
    api<DuelStateDto>(`/duels/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`/duels/${id}`, { method: 'DELETE' }),
};
