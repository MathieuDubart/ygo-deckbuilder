'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DeckGuideDto, DeckGuideRequest, DeckZone } from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

export interface GuideCard {
  cardId: number;
  zone: DeckZone;
  quantity: number;
}

/** Empreinte stable d'une liste (ordre indifférent) pour la clé de cache. */
const fingerprint = (cards: GuideCard[]) =>
  cards
    .map((c) => `${c.zone}${c.cardId}x${c.quantity}`)
    .sort()
    .join(',');

/**
 * Guide de jeu d'une liste. `ai: false` = guide calculé (instantané) ; `ai: true` = rédigé
 * par l'IA du serveur si elle est configurée (plus lent, mis en cache côté API).
 */
export const useDeckGuide = (
  cards: GuideCard[],
  opts: { name?: string; ai: boolean; enabled?: boolean },
) =>
  useQuery({
    queryKey: qk.guide(fingerprint(cards), opts.ai),
    queryFn: () =>
      api<DeckGuideDto>('/suggestions/guide', {
        method: 'POST',
        body: { name: opts.name, cards, ai: opts.ai } satisfies DeckGuideRequest,
      }),
    enabled: (opts.enabled ?? true) && cards.length > 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
