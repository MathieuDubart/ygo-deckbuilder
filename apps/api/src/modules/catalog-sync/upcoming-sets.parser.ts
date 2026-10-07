/**
 * Lecture des sorties annoncées, depuis l'API sémantique de Yugipedia
 * (`action=ask`, propriétés `English release date` / `English set prefix` / `Set type`).
 *
 * Pourquoi cette source : YGOPRODeck ne connaît une extension qu'une fois ses cartes
 * révélées. Une sortie annoncée six mois à l'avance n'y existe pas, alors qu'elle est sur
 * Yugipedia dès l'annonce — c'est tout l'intérêt de la mise en avant « à venir ».
 *
 * Isolé du client HTTP pour être testé sur de vraies réponses.
 */

export interface AskResponse {
  query?: {
    /** SMW sérialise les résultats en objet indexé par titre de page ; certaines installations renvoient un tableau. */
    results?: Record<string, AskResult> | AskResult[];
    meta?: { count?: number; offset?: number };
  };
}

interface AskResult {
  fulltext?: string;
  printouts?: {
    'English name'?: string[];
    'English release date'?: { timestamp?: string | number; raw?: string }[];
    'English set prefix'?: string[];
    'Set type'?: ({ fulltext?: string } | string)[];
  };
}

export interface UpcomingSet {
  /** Nom de l'extension tel que le catalogue le connaîtra (« Beyond the Brave »). */
  name: string;
  /** Préfixe des codes de cartes (« BETB »), ou null. */
  code: string | null;
  /** Date de sortie TCG, à minuit UTC. */
  tcgDate: Date;
  /** Type de produit d'après Yugipedia (« Booster pack »…), pour le journal. */
  setType: string | null;
}

/**
 * Types de « sets » qui ne sont pas des produits qu'on ouvre : une carte promotionnelle
 * isolée ou un deck de démonstration n'a rien à suivre dans une collection, et noierait la
 * mise en avant des vraies sorties.
 */
const IGNORED_SET_TYPES = [
  'promotional card',
  'promotional cards',
  'video game promotional cards',
  'demo deck',
];

/** Propriété SMW multivaluée : on ne garde que la première valeur utile. */
function first<T>(values: T[] | undefined): T | undefined {
  return values?.find((v) => v !== undefined && v !== null && v !== '');
}

function setTypeOf(result: AskResult): string | null {
  const value = first(result.printouts?.['Set type']);
  if (!value) return null;
  return (typeof value === 'string' ? value : (value.fulltext ?? '')) || null;
}

/**
 * Date de sortie. L'horodatage SMW est en secondes ; `raw` (« 1/2026/10/8 ») sert de repli
 * et se lit mois par mois, sans passer par `Date.parse` qui l'interpréterait à l'envers.
 */
function releaseDateOf(result: AskResult): Date | null {
  const value = first(result.printouts?.['English release date']);
  if (!value) return null;
  if (value.timestamp !== undefined && value.timestamp !== '') {
    const seconds = Number(value.timestamp);
    if (Number.isFinite(seconds)) {
      const date = new Date(seconds * 1000);
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
  }
  const parts = value.raw?.split('/');
  if (parts?.length === 4) {
    const [, year, month, day] = parts.map(Number);
    if (year && month && day) return new Date(Date.UTC(year, month - 1, day));
  }
  return null;
}

/**
 * Extensions annoncées dont la sortie est à venir. Les résultats sans date, sans nom, ou
 * d'un type qu'on ignore sont écartés ; le reste est trié par date croissante.
 */
export function parseUpcomingSets(response: AskResponse, now: Date): UpcomingSet[] {
  const results = response.query?.results;
  const list = Array.isArray(results) ? results : Object.values(results ?? {});
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const sets = list.flatMap((result): UpcomingSet[] => {
    const name = (first(result.printouts?.['English name']) ?? result.fulltext ?? '').trim();
    const tcgDate = releaseDateOf(result);
    if (!name || !tcgDate || tcgDate.getTime() < today) return [];
    const setType = setTypeOf(result);
    if (setType && IGNORED_SET_TYPES.includes(setType.toLowerCase())) return [];
    const code = (first(result.printouts?.['English set prefix']) ?? '').trim().toUpperCase();
    return [{ name, code: code || null, tcgDate, setType }];
  });

  // Une même extension peut apparaître deux fois (page principale et page régionale)
  const byName = new Map<string, UpcomingSet>();
  for (const set of sets) if (!byName.has(set.name)) byName.set(set.name, set);
  return [...byName.values()].sort((a, b) => a.tcgDate.getTime() - b.tcgDate.getTime());
}

/**
 * Requête sémantique des sorties à partir d'une date. On demande un peu avant aujourd'hui
 * pour attraper les sorties du jour quel que soit le fuseau du serveur.
 */
export function upcomingSetsQuery(from: Date, limit: number): string {
  const day = from.toISOString().slice(0, 10);
  return [
    '[[Category:All sets]]',
    `[[English release date::>${day}]]`,
    '?English name',
    '?English release date',
    '?English set prefix',
    '?Set type',
    `limit=${limit}`,
    'sort=English release date',
    'order=asc',
  ].join('|');
}
