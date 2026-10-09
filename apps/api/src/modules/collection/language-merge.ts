import type { CardLanguage } from '@ygo/shared';

/** Une pile d'exemplaires, réduite à ce qui décide de son identité. */
export interface Pile {
  id: string;
  cardId: number;
  printId: string | null;
  condition: string;
  language: CardLanguage;
  firstEdition: boolean;
  quantity: number;
}

/** Ce qu'il faut écrire pour que toute la collection parle la même langue. */
export interface LanguagePlan {
  /** Piles à passer dans la langue cible, telles quelles. */
  retag: string[];
  /** Piles à absorber : leurs exemplaires rejoignent `into`, et la pile disparaît. */
  merge: { id: string; into: string; quantity: number }[];
  /** Nouvelle quantité des piles qui en absorbent d'autres. */
  totals: Record<string, number>;
}

/**
 * Deux piles sont la même dès qu'elles ne diffèrent plus que par la langue : même carte, même
 * impression, même état, même édition. C'est exactement ce que la normalisation provoque.
 */
const identity = (p: Pile): string =>
  [p.cardId, p.printId ?? '', p.condition, p.firstEdition ? '1' : '0'].join('|');

/**
 * Plan de normalisation vers `target`.
 *
 * Le piège n'est pas de réécrire la langue, c'est ce que la réécriture crée : deux piles de la
 * même carte, l'une en EN et l'autre en FR, deviennent deux piles identiques. Les laisser côte
 * à côte afficherait deux lignes jumelles dans la collection ; les écraser l'une sur l'autre
 * perdrait des exemplaires. On les fusionne donc en additionnant les quantités.
 *
 * La pile qui absorbe est celle qui est DÉJÀ dans la langue cible quand il y en a une — on ne
 * déplace alors que ce qui doit bouger. Sinon c'est la plus ancienne (le plus petit `id`, les
 * cuid étant croissants dans le temps), pour que deux exécutions donnent le même résultat.
 */
export function planLanguageNormalization(piles: Pile[], target: CardLanguage): LanguagePlan {
  const groups = new Map<string, Pile[]>();
  for (const pile of piles) {
    const key = identity(pile);
    groups.set(key, [...(groups.get(key) ?? []), pile]);
  }

  const plan: LanguagePlan = { retag: [], merge: [], totals: {} };
  for (const group of groups.values()) {
    const wrong = group.filter((p) => p.language !== target);
    if (wrong.length === 0) continue;

    // Rien à fusionner : la pile change juste d'étiquette.
    if (group.length === 1) {
      plan.retag.push(wrong[0]!.id);
      continue;
    }

    const keeper =
      group.find((p) => p.language === target) ??
      [...group].sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
    if (keeper.language !== target) plan.retag.push(keeper.id);

    let total = keeper.quantity;
    for (const pile of group) {
      if (pile.id === keeper.id) continue;
      plan.merge.push({ id: pile.id, into: keeper.id, quantity: pile.quantity });
      total += pile.quantity;
    }
    plan.totals[keeper.id] = total;
  }
  return plan;
}

/** Ce qu'on annonce avant d'écrire : combien de piles bougent, combien disparaissent en fusion. */
export interface LanguageReport {
  /** Répartition actuelle, langue par langue. */
  byLanguage: { language: CardLanguage; piles: number; copies: number }[];
  /** Piles qui changeraient de langue (fusions comprises). */
  affected: number;
  /** Piles qui disparaîtraient, absorbées par une autre. */
  merged: number;
}

export function languageReport(piles: Pile[], target: CardLanguage): LanguageReport {
  const counts = new Map<CardLanguage, { piles: number; copies: number }>();
  for (const p of piles) {
    const cur = counts.get(p.language) ?? { piles: 0, copies: 0 };
    counts.set(p.language, { piles: cur.piles + 1, copies: cur.copies + p.quantity });
  }
  const plan = planLanguageNormalization(piles, target);
  return {
    byLanguage: [...counts]
      .map(([language, c]) => ({ language, ...c }))
      .sort((a, b) => b.copies - a.copies),
    affected: plan.retag.length + plan.merge.length,
    merged: plan.merge.length,
  };
}
