import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import type { YgoCard, YgoDbVersion, YgoSetInfo } from './ygoprodeck.types';

/**
 * Client HTTP minimal pour YGOPRODeck.
 * Rappel de leurs règles : 20 req/s max, et on ne hotlinke pas leurs images en masse
 * → d'où la sync locale (et plus tard un cache d'images).
 */
@Injectable()
export class YgoprodeckClient {
  private readonly logger = new Logger(YgoprodeckClient.name);

  constructor(private readonly config: AppConfig) {}

  dbVersion(): Promise<YgoDbVersion | undefined> {
    return this.get<YgoDbVersion[]>('/checkDBVer.php').then((r) => r[0]);
  }

  async allCards(language?: 'fr'): Promise<YgoCard[]> {
    const params = new URLSearchParams({ misc: 'yes' });
    if (language) params.set('language', language);
    const res = await this.get<{ data: YgoCard[] }>(`/cardinfo.php?${params}`);
    return res.data;
  }

  allSets(): Promise<YgoSetInfo[]> {
    return this.get<YgoSetInfo[]>('/cardsets.php');
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.config.get('YGOPRODECK_BASE_URL')}${path}`;
    this.logger.debug(`GET ${url}`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ygo-deckbuilder (self-hosted)' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`YGOPRODeck ${res.status} sur ${path}`);
    return (await res.json()) as T;
  }
}
