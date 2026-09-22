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

  /**
   * Texte wiki de la première page existante parmi `titles` (dans cet ordre), après avoir
   * suivi les redirections. Sert aux listes de cartes officielles des produits.
   */
  async firstExistingWikitext(titles: string[]): Promise<{ title: string; text: string } | null> {
    const json = (await this.get({
      action: 'query',
      redirects: '1',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: titles.join('|'),
    })) as WikitextResponse;
    const pages = new Map((json.query?.pages ?? []).map((p) => [p.title, p]));
    const normalized = new Map(json.query?.normalized?.map((n) => [n.from, n.to]));
    const redirects = new Map(json.query?.redirects?.map((r) => [r.from, r.to]));
    for (const requested of titles) {
      let t = normalized.get(requested) ?? requested;
      t = redirects.get(t) ?? t;
      const rev = pages.get(t)?.revisions?.[0];
      const text = rev?.slots?.main?.content ?? rev?.content;
      if (text) return { title: t, text };
    }
    return null;
  }

  /** Titre canonique d'une page (redirections suivies), ou null si elle n'existe pas. */
  async resolveTitle(title: string): Promise<string | null> {
    const json = (await this.get({
      action: 'query',
      redirects: '1',
      titles: title,
    })) as WikitextResponse;
    const page = json.query?.pages?.[0];
    return page && !page.missing ? page.title : null;
  }

  private async get(params: Record<string, string>): Promise<unknown> {
    const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
    const res = await fetch(`${this.config.get('YUGIPEDIA_API_URL')}?${qs}`, {
      headers: { 'User-Agent': 'ygo-deckbuilder (self-hosted; product card lists)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Yugipedia ${res.status}`);
    return res.json();
  }
}

interface WikitextResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: {
      title: string;
      missing?: boolean;
      revisions?: { content?: string; slots?: { main?: { content?: string } } }[];
    }[];
  };
}
