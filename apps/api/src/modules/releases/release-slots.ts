/**
 * Ce qu'une collection coche dans la checklist d'une extension.
 *
 * Une extension n'est pas une liste de lignes mais une liste de CASES, et les deux ne
 * coïncident pas :
 *  - une carte éditée en Commune et en Ultra porte le même numéro : deux lignes, une case ;
 *  - un structure deck contient trois Dragon Blanc aux numéros 001, 002 et 003 : trois cases
 *    pour une seule carte, et il faut trois exemplaires pour les remplir.
 *
 * D'où la règle, unique pour les deux cas : une case est remplie dès qu'on possède, dans
 * cette extension, assez d'exemplaires de sa carte pour la couvrir. Posséder trois Dragon
 * Blanc achetés dans le structure deck remplit donc ses trois cases, même si la collection
 * les range sur une seule impression — ce qu'elle fait toujours, puisque les trois sont la
 * même carte dans la même rareté.
 *
 * Sans I/O : la même fonction sert à l'avancement global, à l'avancement par rareté et à
 * l'état affiché ligne par ligne, qui doivent dire la même chose.
 */

/** Une case de la checklist : un code d'impression, et ce qu'on a posé dessus. */
export interface Slot {
  printCode: string;
  /** Exemplaires rattachés à ce code précis. */
  owned: number;
}

/** Une case, et d'où vient le fait qu'elle soit cochée. */
export interface CoveredSlot extends Slot {
  /**
   * Exemplaires qui cochent la case sans être posés dessus : la même carte, achetée dans
   * cette extension, mais rangée sur un autre numéro ou une autre rareté. Zéro quand la
   * case est cochée par son propre exemplaire, ou pas cochée du tout.
   */
  covered: number;
}

/**
 * Répartit les exemplaires d'UNE carte sur les cases qu'elle occupe dans l'extension.
 *
 * `copies` est le total possédé dans cette extension, exemplaires posés sur les cases
 * compris. Les cases déjà pourvues sont servies d'abord — elles consomment le leur — puis
 * le reliquat couvre les autres, dans l'ordre des numéros pour que deux appels donnent la
 * même réponse.
 */
export function coverSlots(slots: Slot[], copies: number): CoveredSlot[] {
  const ordered = [...slots].sort(
    (a, b) => Number(b.owned > 0) - Number(a.owned > 0) || a.printCode.localeCompare(b.printCode),
  );
  let spare = copies;
  const covered = new Map<string, number>();
  for (const slot of ordered) {
    if (slot.owned > 0) {
      spare -= 1; // la case paie son propre exemplaire
      covered.set(slot.printCode, 0);
    } else if (spare > 0) {
      spare -= 1;
      covered.set(slot.printCode, 1);
    } else {
      covered.set(slot.printCode, 0);
    }
  }
  // L'ordre d'entrée est celui de l'affichage : on ne le bouscule pas pour une règle interne
  return slots.map((slot) => ({ ...slot, covered: covered.get(slot.printCode) ?? 0 }));
}

/**
 * Cases cochées pour une carte. C'est `coverSlots` réduit à son compte, et la formule que
 * le SQL de `SetProgress` reproduit avec un `LEAST` : on ne peut pas cocher plus de cases
 * qu'il n'y en a, ni plus que d'exemplaires en main.
 */
export function filledSlots(slotCount: number, copies: number): number {
  return Math.max(0, Math.min(slotCount, copies));
}
