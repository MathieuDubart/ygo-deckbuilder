/**
 * Lecture des listes de cartes Yugipedia (« Set Card Lists:<produit> (TCG-EN) »), écrites avec
 * le modèle {{Set list}} :
 *
 *   {{Set list|region=EN|rarities=C|qty=1|print=Reprint|
 *   SDBE-EN001; Blue-Eyes White Dragon; UR
 *   SDBE-EN018; Shining Angel; C;; 2
 *   }}
 *
 * Colonnes : code ; nom ; rareté(s) ; impression ; quantité. `qty=` dans l'en-tête = quantité
 * par défaut. Le même code peut apparaître dans plusieurs blocs (variantes de rareté) :
 * on garde la quantité la plus haute, pas la somme.
 */
export interface SetListRow {
  code: string;
  name: string;
  quantity: number;
}

/** Un bloc {{Set list}} et le titre de section (== … ==) sous lequel il se trouve. */
export interface SetListBlock {
  heading: string | null;
  rows: SetListRow[];
}

export function parseSetListBlocks(wikitext: string): SetListBlock[] {
  const headings = [...wikitext.matchAll(/^\s*(={2,4})\s*(.+?)\s*\1\s*$/gm)].map((m) => ({
    at: m.index ?? 0,
    title: m[2]!.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').trim(),
  }));
  const blocks: SetListBlock[] = [];
  for (const block of wikitext.matchAll(/\{\{\s*Set list\s*\|([\s\S]*?)\n\s*\}\}/gi)) {
    const at = block.index ?? 0;
    const heading = headings.filter((h) => h.at < at).at(-1)?.title ?? null;
    const body = block[1]!;
    const firstBreak = body.indexOf('\n');
    const header = firstBreak >= 0 ? body.slice(0, firstBreak) : body;
    const defaultQty = Number(/(?:^|\|)\s*qty\s*=\s*(\d+)/i.exec(header)?.[1] ?? 1) || 1;

    const rows: SetListRow[] = [];
    for (const raw of body.slice(firstBreak + 1).split('\n')) {
      const line = raw.replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('{{') || line.startsWith('|')) continue;
      const cols = line.split(';').map((c) => c.trim());
      const code = cols[0]?.toUpperCase();
      const name = cols[1];
      if (!code || !name || !/^[A-Z0-9]+-[A-Z]*\d+[A-Z]?$/.test(code)) continue;
      rows.push({ code, name, quantity: Number(cols[4]) || defaultQty });
    }
    blocks.push({ heading, rows });
  }
  return blocks;
}

export function parseSetList(wikitext: string): SetListRow[] {
  const byCode = new Map<string, SetListRow>();
  for (const { rows } of parseSetListBlocks(wikitext)) {
    for (const row of rows) {
      const prev = byCode.get(row.code);
      if (!prev || row.quantity > prev.quantity) byCode.set(row.code, row);
    }
  }
  return [...byCode.values()];
}

/** Sections qui ne font pas partie d'un deck jouable (variantes de rareté, promos, jetons…). */
const NOT_A_DECK = /variant|promo|bonus|token|upgrade|reprint|replica|alternate/i;

export interface OfficialDeckList {
  /** Nom de la section (« Yugi Deck », « Synchro Deck »), null = le produit est un seul deck */
  name: string | null;
  rows: SetListRow[];
}

/**
 * Decks préconstruits d'un produit : une section « … Deck » par deck (coffrets Legendary
 * Decks, 2-Player Starter Set…), sinon tout le produit s'il s'agit d'un deck (structure,
 * starter). Les jetons (« Token ») ne comptent pas.
 */
export function officialDecks(blocks: SetListBlock[], productIsDeck: boolean): OfficialDeckList[] {
  const playable = (rows: SetListRow[]) => rows.filter((r) => !/^token\b/i.test(r.name));
  const merge = (bs: SetListBlock[]) => {
    const byCode = new Map<string, SetListRow>();
    for (const r of bs.flatMap((b) => playable(b.rows))) {
      const prev = byCode.get(r.code);
      if (!prev || r.quantity > prev.quantity) byCode.set(r.code, r);
    }
    return [...byCode.values()];
  };

  const deckSections = new Map<string, SetListBlock[]>();
  for (const b of blocks) {
    if (!b.heading || NOT_A_DECK.test(b.heading) || !/\bdeck\b/i.test(b.heading)) continue;
    deckSections.set(b.heading, [...(deckSections.get(b.heading) ?? []), b]);
  }
  if (deckSections.size >= 2 || (deckSections.size === 1 && !productIsDeck)) {
    return [...deckSections].map(([name, bs]) => ({ name, rows: merge(bs) }));
  }
  if (!productIsDeck) return [];
  const rows = merge(blocks.filter((b) => !b.heading || !NOT_A_DECK.test(b.heading)));
  return rows.length ? [{ name: null, rows }] : [];
}

/** Titres candidats de la liste de cartes d'un produit, du plus récent au plus ancien format. */
export const setListTitles = (productTitle: string) =>
  ['TCG-EN', 'NA-EN', 'EU-EN', 'EN'].map((r) => `Set Card Lists:${productTitle} (${r})`);
