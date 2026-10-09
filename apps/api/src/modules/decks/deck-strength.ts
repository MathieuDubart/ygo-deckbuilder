import type {
  EntrySource,
  GeneratedEntry,
  GenerationResult,
} from '../meta-decks/engine/generator';
import type { DeckAnalysis, DeckEntry, Zone } from '../synergy/engine/graph';

/**
 * Donner à un deck écrit à la main la même note qu'à un deck généré.
 *
 * `scoreDeck` ne sait pas lire un deck : il lit une SORTIE DU GÉNÉRATEUR, où chaque ligne
 * porte son origine — cœur d'archétype, staple, remplissage — et c'est de ces origines que
 * sortent « moteur », « remplissage » et « régularité ». Un deck saisi à la main n'a aucune
 * origine : il faut la déduire, sans quoi la moitié de la note est incalculable et les
 * decks de l'utilisateur resteraient les seuls sans note.
 *
 * La déduction se lit dans cet ordre, du signe le plus sûr au plus faible :
 *  1. une carte que tout le monde joue est un STAPLE, quelle que soit sa place ici ;
 *  2. une carte de l'archétype dominant du deck en est le cœur (ARCHETYPE) ;
 *  3. une carte reliée à une autre carte du deck le fait tourner (SUPPORT) ;
 *  4. le reste est du remplissage (FILLER).
 *
 * Le point 3 est ce qui rend justice aux decks hors archétype : un deck de pièges n'a pas
 * d'archétype, mais ses cartes se parlent, et il ne mérite pas d'être noté comme un tas.
 *
 * Pur, sans I/O.
 */

/** L'archétype le plus représenté dans le main deck, s'il en domine un. */
export function dominantArchetype(entries: DeckEntry[]): string | null {
  const copies = new Map<string, number>();
  let main = 0;
  for (const e of entries) {
    if (e.zone !== 'MAIN') continue;
    main += e.quantity;
    const a = e.card.archetype;
    if (a) copies.set(a, (copies.get(a) ?? 0) + e.quantity);
  }
  if (!main) return null;
  const best = [...copies].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  // Un quart du deck : en dessous, c'est une carte d'archétype qui passe, pas un thème
  return best && best[1] >= main * 0.25 ? best[0] : null;
}

/** D'où vient cette carte, du point de vue de la note. */
export function sourceOf(
  entry: DeckEntry,
  opts: { archetype: string | null; stapleIds: ReadonlySet<number>; connected: ReadonlySet<number> },
): EntrySource {
  if (opts.stapleIds.has(entry.card.id)) return 'STAPLE';
  if (opts.archetype && entry.card.archetype === opts.archetype) return 'ARCHETYPE';
  if (opts.connected.has(entry.card.id)) return 'SUPPORT';
  return 'FILLER';
}

/** Cartes reliées à au moins une AUTRE carte du deck, dans un sens ou dans l'autre. */
export function connectedCards(analysis: DeckAnalysis): Set<number> {
  const out = new Set<number>();
  for (const edge of analysis.edges) {
    // `MENTION` ne prouve rien : citer un nom n'est pas s'en servir
    if (edge.verb === 'MENTION' || edge.from === edge.to) continue;
    out.add(edge.from);
    out.add(edge.to);
  }
  return out;
}

/**
 * Le deck de l'utilisateur, présenté comme une sortie du générateur pour que `scoreDeck`
 * puisse le lire. `owned` vaut la quantité : ce sont ses cartes, il les a par définition.
 */
export function asGenerationResult(
  entries: DeckEntry[],
  analysis: DeckAnalysis,
  stapleIds: ReadonlySet<number>,
): GenerationResult {
  const archetype = dominantArchetype(entries);
  const connected = connectedCards(analysis);
  const generated: GeneratedEntry[] = entries.map((entry) => ({
    cardId: entry.card.id,
    zone: entry.zone,
    quantity: entry.quantity,
    owned: entry.quantity,
    source: sourceOf(entry, { archetype, stapleIds, connected }),
    inclusion: null,
  }));
  const counts: Record<Zone, number> = { MAIN: 0, EXTRA: 0, SIDE: 0 };
  for (const e of generated) counts[e.zone] += e.quantity;
  return { entries: generated, counts, missingCopies: 0, complete: counts.MAIN >= 40 };
}
