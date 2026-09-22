/**
 * Exemplaires de chaque carte dans UN produit, à partir de ses impressions.
 * Une même carte peut avoir plusieurs impressions (codes différents, ou même code en
 * plusieurs raretés) : par code on prend la quantité connue la plus haute, puis on additionne
 * les codes. Quantité inconnue (pas de liste officielle) → 1 exemplaire.
 */
export interface PrintRow {
  id: string;
  cardId: number;
  printCode: string;
  rarity: string;
  setQuantity: number | null;
}

export interface ProductCard {
  cardId: number;
  /** Impression de référence (la plus basse) : celle qu'on ajoute à la collection */
  printId: string;
  printCode: string;
  rarity: string;
  quantity: number;
}

export function productCards(prints: PrintRow[]): ProductCard[] {
  const byCard = new Map<number, PrintRow[]>();
  for (const p of prints) byCard.set(p.cardId, [...(byCard.get(p.cardId) ?? []), p]);

  const out: ProductCard[] = [];
  for (const [cardId, rows] of byCard) {
    const sorted = [...rows].sort((a, b) => a.printCode.localeCompare(b.printCode));
    const perCode = new Map<string, number | null>();
    for (const r of sorted) {
      const prev = perCode.get(r.printCode);
      perCode.set(
        r.printCode,
        r.setQuantity === null ? (prev ?? null) : Math.max(prev ?? 0, r.setQuantity),
      );
    }
    const known = [...perCode.values()].filter((q): q is number => q !== null);
    const first = sorted[0]!;
    out.push({
      cardId,
      printId: first.id,
      printCode: first.printCode,
      rarity: first.rarity,
      quantity: known.length
        ? Math.max(
            1,
            known.reduce((s, q) => s + q, 0),
          )
        : 1,
    });
  }
  return out.sort((a, b) => a.printCode.localeCompare(b.printCode));
}
