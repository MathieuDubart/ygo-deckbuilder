import { RECENT_RELEASE_DAYS, type ReleaseStatus } from '@ygo/shared';

/**
 * Logique pure du suivi par extension : où en est une sortie par rapport à aujourd'hui, et
 * comment ranger ses raretés. Aucune I/O, donc testable directement.
 */

const DAY_MS = 86_400_000;

/** Minuit UTC du jour d'une date : les dates de sortie sont des jours, pas des instants. */
function startOfDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Jours entiers avant la sortie : positif si elle est à venir, négatif si elle est passée,
 * 0 le jour même. Null si la date est inconnue.
 */
export function daysUntilRelease(tcgDate: Date | null, today: Date): number | null {
  if (!tcgDate) return null;
  return Math.round((startOfDay(tcgDate) - startOfDay(today)) / DAY_MS);
}

/**
 * Une extension sans date connue est considérée comme sortie : c'est le cas des vieux sets
 * et des sets hors TCG, qu'on ne veut pas voir remonter dans « à venir ».
 */
export function releaseStatus(tcgDate: Date | null, today: Date): ReleaseStatus {
  const days = daysUntilRelease(tcgDate, today);
  if (days === null) return 'RELEASED';
  if (days > 0) return 'UPCOMING';
  return days > -RECENT_RELEASE_DAYS ? 'RECENT' : 'RELEASED';
}

/** Taux d'avancement entre 0 et 1 ; 0 quand l'extension n'a encore aucune carte connue. */
export function completion(owned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, owned / total);
}

/**
 * Hiérarchie des raretés, de la plus courante à la plus rare. Elle sert à présenter
 * l'avancement d'une extension dans l'ordre où on ouvre les cartes ; les libellés inconnus
 * (il en apparaît à chaque nouvelle série) passent après, les plus nombreux d'abord.
 */
const RARITY_ORDER = [
  'common',
  'short print',
  'super short print',
  'normal parallel rare',
  'rare',
  'super rare',
  'ultra rare',
  'ultra parallel rare',
  'ultimate rare',
  'gold rare',
  'platinum rare',
  'secret rare',
  'prismatic secret rare',
  'extra secret rare',
  'ghost rare',
  "collector's rare",
  'quarter century secret rare',
  'starlight rare',
];

function rank(rarity: string): number {
  const index = RARITY_ORDER.indexOf(rarity.trim().toLowerCase());
  return index === -1 ? RARITY_ORDER.length : index;
}

export function sortRarities<T extends { rarity: string; prints: number }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      rank(a.rarity) - rank(b.rarity) || b.prints - a.prints || a.rarity.localeCompare(b.rarity),
  );
}
