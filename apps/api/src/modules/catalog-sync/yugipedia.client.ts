import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { COVER_WIDTH, mapPageImages, type PageImagesResponse } from './yugipedia.parser';

/**
 * Client minimal pour l'API MediaWiki de Yugipedia : image principale (boîte, booster…)
 * de la page d'un produit, en haute qualité.
 * Politesse : 50 titres par requête (max MediaWiki), 1 requête/s, User-Agent identifiable.
 */
@Injectable()
export class YugipediaClient {
  private readonly logger = new Logger(YugipediaClient.name);
  static readonly BATCH = 50;

  constructor(private readonly config: AppConfig) {}

  async pageImages(titles: string[]): Promise<Map<string, string | null>> {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: String(COVER_WIDTH),
      titles: titles.join('|'),
    });
    const url = `${this.config.get('YUGIPEDIA_API_URL')}?${params}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ygo-deckbuilder (self-hosted; product cover lookup)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Yugipedia ${res.status}`);
    return mapPageImages(titles, (await res.json()) as PageImagesResponse);
  }
}
