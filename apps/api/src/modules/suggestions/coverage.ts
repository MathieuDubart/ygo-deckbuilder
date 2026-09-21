/**
 * Cœur (pur, sans I/O) du moteur de suggestion "meta" : pour une decklist de référence
 * et une collection, calcule le taux de couverture et ce qu'il manque.
 * Isolé ici pour être testé unitairement et remplacé/enrichi plus tard
 * (moteur de synergie) sans toucher au reste.
 */

export interface RequiredCard {
  cardId: number;
  zone: 'MAIN' | 'EXTRA' | 'SIDE';
  quantity: number;
  unitPrice: number | null;
}

export interface CoverageResult {
  coverage: number;
  ownedCopies: number;
  requiredCopies: number;
  missing: (RequiredCard & { owned: number; missing: number })[];
  estimatedCostToComplete: number;
}

/**
 * - Le side deck est ignoré pour la couverture (il dépend du meta local).
 * - Une même carte peut être dans MAIN et EXTRA (rare) : les exemplaires possédés
 *   sont "consommés" zone par zone pour ne pas les compter deux fois.
 */
export function computeCoverage(
  required: RequiredCard[],
  owned: ReadonlyMap<number, number>,
): CoverageResult {
  const remaining = new Map(owned);
  let ownedCopies = 0;
  let requiredCopies = 0;
  let cost = 0;
  const missing: CoverageResult['missing'] = [];

  const ordered = required
    .filter((r) => r.zone !== 'SIDE')
    .sort((a, b) => (a.zone === b.zone ? 0 : a.zone === 'MAIN' ? -1 : 1));

  for (const r of ordered) {
    const available = remaining.get(r.cardId) ?? 0;
    const used = Math.min(available, r.quantity);
    remaining.set(r.cardId, available - used);

    requiredCopies += r.quantity;
    ownedCopies += used;
    const lacking = r.quantity - used;
    if (lacking > 0) {
      missing.push({ ...r, owned: used, missing: lacking });
      cost += lacking * (r.unitPrice ?? 0);
    }
  }

  missing.sort((a, b) => (b.unitPrice ?? 0) * b.missing - (a.unitPrice ?? 0) * a.missing);

  return {
    coverage: requiredCopies ? ownedCopies / requiredCopies : 0,
    ownedCopies,
    requiredCopies,
    missing,
    estimatedCostToComplete: Math.round(cost * 100) / 100,
  };
}
