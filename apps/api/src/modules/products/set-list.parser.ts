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

export function parseSetList(wikitext: string): SetListRow[] {
  const byCode = new Map<string, SetListRow>();
  for (const block of wikitext.matchAll(/\{\{\s*Set list\s*\|([\s\S]*?)\n\s*\}\}/gi)) {
    const body = block[1]!;
    const firstBreak = body.indexOf('\n');
    const header = firstBreak >= 0 ? body.slice(0, firstBreak) : body;
    const defaultQty = Number(/(?:^|\|)\s*qty\s*=\s*(\d+)/i.exec(header)?.[1] ?? 1) || 1;

    for (const raw of body.slice(firstBreak + 1).split('\n')) {
      const line = raw.replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('{{') || line.startsWith('|')) continue;
      const cols = line.split(';').map((c) => c.trim());
      const code = cols[0]?.toUpperCase();
      const name = cols[1];
      if (!code || !name || !/^[A-Z0-9]+-[A-Z]*\d+[A-Z]?$/.test(code)) continue;
      const qty = Number(cols[4]) || defaultQty;
      const prev = byCode.get(code);
      if (!prev || qty > prev.quantity) byCode.set(code, { code, name, quantity: qty });
    }
  }
  return [...byCode.values()];
}

/** Titres candidats de la liste de cartes d'un produit, du plus récent au plus ancien format. */
export const setListTitles = (productTitle: string) =>
  ['TCG-EN', 'NA-EN', 'EU-EN', 'EN'].map((r) => `Set Card Lists:${productTitle} (${r})`);
