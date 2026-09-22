/**
 * Réponse de l'API MediaWiki de Yugipedia (action=query, prop=pageimages, formatversion=2).
 * Isolé du client HTTP pour être testé sur des réponses réelles.
 */
export interface PageImagesResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: {
      title: string;
      missing?: boolean;
      thumbnail?: { source: string; width: number; height: number };
    }[];
  };
}

/** Largeur demandée : nette en grand (≈ 2× la taille affichée), sans télécharger des originaux de 2 Mo. */
export const COVER_WIDTH = 600;

/**
 * Associe chaque titre demandé à l'URL de l'image principale de sa page,
 * en suivant normalisations ("_" → " ") et redirections.
 */
export function mapPageImages(
  requested: string[],
  res: PageImagesResponse,
): Map<string, string | null> {
  const normalized = new Map(res.query?.normalized?.map((n) => [n.from, n.to]));
  const redirects = new Map(res.query?.redirects?.map((r) => [r.from, r.to]));
  const images = new Map(
    (res.query?.pages ?? [])
      .filter((p) => !p.missing)
      .map((p) => [p.title, p.thumbnail?.source ?? null]),
  );

  return new Map(
    requested.map((title) => {
      let t = normalized.get(title) ?? title;
      t = redirects.get(t) ?? t;
      return [title, images.get(t) ?? null];
    }),
  );
}

/** Un titre MediaWiki ne peut pas contenir ces caractères : inutile de le demander. */
export const isValidTitle = (title: string) => !/[#<>[\]|{}]/.test(title) && title.length < 250;
