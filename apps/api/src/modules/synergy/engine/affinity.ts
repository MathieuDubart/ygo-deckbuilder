import { featuresOf, linkQuality } from './graph';
import type { SynCard } from './types';

/**
 * Affinité d'une carte candidate avec le "cœur" d'un deck : combien de liens réels
 * (recherche, invocation, envoi au cimetière, citation) elle a avec les cartes déjà là,
 * dans les deux sens, plus un bonus pour les rôles qui font tourner un deck.
 * Sert à choisir, parmi les cartes possédées, celles qui s'emboîtent vraiment.
 */
export function affinity(core: SynCard[], candidate: SynCard): number {
  const fc = featuresOf(candidate);
  let score = linkScore(core, candidate);

  // Extra Deck : la candidate est-elle invocable avec le cœur ? On le vérifie ailleurs
  // (checkExtra) ; ici on ne récompense que ses matériaux cités.
  if (candidate.isExtraDeck) return Math.min(score, 6);

  // Rôles qui lancent / prolongent le jeu, utiles même sans lien direct
  if (fc.selfSummon) score += 0.75;
  if (fc.handTrap) score += 1;
  if (
    fc.actions.some(
      (a) => a.from.includes('DECK') && (a.verb === 'SEARCH' || a.verb === 'SPECIAL_SUMMON'),
    )
  ) {
    score += 0.5;
  }
  if (fc.draws) score += 0.5;
  // Monstre lourd que rien n'invoque : mauvais signe
  if (candidate.category === 'MONSTER' && fc.cannotNormalSummon && !fc.selfSummon && score < 1)
    score -= 1;
  return Math.min(score, 8);
}

/**
 * La part « liens » de l'affinité, sans les bonus de rôle : combien de vrais liens la
 * candidate a avec le cœur, dans les deux sens. C'est ce qui distingue une carte d'un autre
 * archétype qui s'emboîte vraiment (elle cherche nos monstres, nos effets l'invoquent) d'une
 * bonne carte générique — et c'est donc ce qui sert à repérer un second moteur.
 */
export function linkScore(core: SynCard[], candidate: SynCard): number {
  const fc = featuresOf(candidate);
  let score = 0;
  for (const c of core) {
    if (c.id === candidate.id) continue;
    const fk = featuresOf(c);
    // La candidate agit sur une carte du cœur (Sage cherche White Stone…). Seuls les vrais
    // liens comptent : « 1 monstre de Niveau 4 ou moins » touche toute la collection.
    if (fc.actions.some((a) => a.verb !== 'SUMMON_EXTRA' && linkQuality(a, c, fk) === 2)) {
      score += 1;
    }
    // Une carte du cœur agit sur la candidate (Dictator ressuscite un "Blue-Eyes"…)
    if (fk.actions.some((a) => linkQuality(a, candidate, fc) === 2)) score += 1;
    // Citation de nom sans action lisible : lien plus faible
    if (fc.mentions.includes(c.name) || fk.mentions.includes(candidate.name)) score += 0.5;
  }
  return score;
}

/**
 * Réordonne des cartes (déjà triées par popularité/usage en tournoi) en tenant compte de
 * leur affinité avec le cœur. L'ordre d'origine garde du poids : une carte très jouée
 * mais sans lien lisible n'est pas jetée, juste doublée par une carte plus synergique.
 */
export function rankBySynergy(
  core: SynCard[],
  ids: number[],
  cards: Map<number, SynCard>,
  weight = 1,
): number[] {
  const n = Math.max(ids.length, 1);
  const scored = ids.map((id, i) => {
    const card = cards.get(id);
    const aff = card ? affinity(core, card) : 0;
    return { id, key: weight * aff + 2 * (1 - i / n) };
  });
  return scored.sort((a, b) => b.key - a.key).map((s) => s.id);
}
