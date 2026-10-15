'use client';
import { cardmarketSearchUrl, marketName, type CardSummaryDto } from '@ygo/shared';
import { useLocale } from 'next-intl';
import { useMe } from '@/lib/api/auth';

type Named = Pick<CardSummaryDto, 'name' | 'nameEn'>;

/**
 * Fabrique les liens d'achat de l'utilisateur : ses préférences, sa langue d'interface, et le
 * nom anglais de la carte.
 *
 * La langue d'achat non réglée retombe sur celle de la collection — c'est déjà un choix
 * assumé, et en redemander un second ici obligerait à le tenir à jour à deux endroits.
 */
export function useMarketLink(): (card: Named) => string {
  const locale = useLocale();
  const { data: me } = useMe();
  const preferences = {
    language: me?.marketLanguage ?? me?.collectionLanguage ?? null,
    minCondition: me?.marketMinCondition ?? null,
  };
  return (card) => cardmarketSearchUrl(marketName(card), preferences, locale);
}
