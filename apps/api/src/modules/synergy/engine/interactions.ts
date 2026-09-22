import { featuresOf } from './graph';
import type { CardFeatures, CardFilter, Location, SynCard, Verb } from './types';

/**
 * Interactions d'une carte avec le reste du catalogue, indépendamment d'un deck :
 *  - ses cibles (ce qu'elle cherche / invoque / envoie, ses matériaux, les noms qu'elle cite)
 *  - classées par précision : un effet qui vise « 1 monstre » ne dit rien d'utile.
 * Les cibles précises sont indexées en base pour la question inverse (« qui me cherche ? »).
 */

export type InteractionVerb = Verb | 'MATERIAL' | 'MENTION';

/** 2 = cite un nom / archétype · 1 = filtre serré (≥ 2 critères) · 0 = générique */
export type Precision = 0 | 1 | 2;

export interface EffectTarget {
  verb: InteractionVerb;
  locations: Location[];
  filter: CardFilter;
  precision: Precision;
  /** Clés de recherche (minuscules) : noms / archétypes cités */
  keys: string[];
}

/** Critères "qui filtrent vraiment" (type Effect exclu : presque tous les monstres le sont). */
export function precisionOf(f: CardFilter): Precision {
  if (f.quoted.length) return 2;
  let criteria = 0;
  if (f.attributes.length) criteria++;
  if (f.races.length) criteria++;
  if (f.levelEq !== undefined || f.levelMin !== undefined || f.levelMax !== undefined) criteria++;
  if (f.tuner || f.nonTuner) criteria++;
  if (f.subtypes.some((s) => s !== 'Effect' && s !== 'Normal')) criteria++;
  return criteria >= 2 ? 1 : 0;
}

const key = (s: string) => s.toLowerCase().trim();

export function targetsOfCard(
  card: SynCard,
  features: CardFeatures = featuresOf(card),
): EffectTarget[] {
  const out: EffectTarget[] = [];
  const push = (verb: InteractionVerb, locations: Location[], filter: CardFilter) =>
    out.push({
      verb,
      locations,
      filter,
      precision: precisionOf(filter),
      keys: filter.quoted.map(key),
    });

  for (const a of features.actions) for (const f of a.filters) push(a.verb, a.from, f);

  const m = features.materials;
  if (m && !m.exotic) {
    for (const p of m.parts) push('MATERIAL', [], p.filter);
    if (m.tuner) push('MATERIAL', [], m.tuner.filter);
    if (m.nonTuner) push('MATERIAL', [], m.nonTuner.filter);
    if (m.filter) {
      push(
        'MATERIAL',
        [],
        m.mechanic === 'XYZ' && m.level ? { ...m.filter, levelEq: m.level } : m.filter,
      );
    }
  }

  // Noms cités sans action lisible ("… if you control "X" …") : lien faible mais direct
  const covered = new Set(out.flatMap((t) => t.keys));
  const materialLine = card.isExtraDeck ? (card.desc.split('\n')[0] ?? '') : '';
  for (const name of features.mentions) {
    if (
      covered.has(key(name)) ||
      features.treatedAs.includes(name) ||
      features.fieldNames.includes(name)
    )
      continue;
    if (materialLine.includes(`"${name}"`)) continue;
    push('MENTION', [], {
      quoted: [name],
      except: [],
      kinds: [],
      subtypes: [],
      races: [],
      attributes: [],
    });
  }
  return dedupe(out);
}

function dedupe(xs: EffectTarget[]): EffectTarget[] {
  const seen = new Set<string>();
  return xs.filter((t) => {
    const k = `${t.verb}|${JSON.stringify(t.filter)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Clés sous lesquelles une carte peut être visée par son nom : nom, archétype, noms
 * "traités comme", et toutes les suites de mots de son nom ("Dark Magician" dans
 * "Dark Magician Girl") — même logique que `matches()`.
 */
export function nameKeys(card: SynCard, features: CardFeatures = featuresOf(card)): string[] {
  const keys = new Set<string>([key(card.name)]);
  if (card.archetype) keys.add(key(card.archetype));
  for (const n of [...features.treatedAs, ...features.fieldNames]) keys.add(key(n));
  const words = card.name.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j <= Math.min(words.length, i + 6); j++)
      keys.add(key(words.slice(i, j).join(' ')));
  }
  return [...keys];
}

// ─── Description en français d'un filtre ─────────────────────────────────────

const ATTR_FR: Record<string, string> = {
  LIGHT: 'LUMIÈRE',
  DARK: 'TÉNÈBRES',
  EARTH: 'TERRE',
  WATER: 'EAU',
  FIRE: 'FEU',
  WIND: 'VENT',
  DIVINE: 'DIVIN',
};

/** « monstre « Blue-Eyes » », « Syntoniseur LUMIÈRE de niveau 1 », « Magie Rituelle »… */
export function describeFilter(f: CardFilter): string {
  const parts: string[] = [];
  const kind = f.kinds.length === 1 ? f.kinds[0] : f.kinds.length > 1 ? 'SPELL_TRAP' : null;
  const noun = f.tuner
    ? 'Syntoniseur'
    : f.nonTuner
      ? 'non-Syntoniseur'
      : kind === 'SPELL'
        ? 'Magie'
        : kind === 'TRAP'
          ? 'Piège'
          : kind === 'SPELL_TRAP'
            ? 'Magie/Piège'
            : kind === 'MONSTER'
              ? 'monstre'
              : 'carte';
  if (!(noun === 'carte' && f.quoted.length)) parts.push(noun);
  const sub = f.subtypes.filter((s) => s !== 'Effect');
  if (sub.length) parts.push(sub.join('/'));
  if (f.races.length) parts.push(f.races.join('/'));
  if (f.attributes.length) parts.push(f.attributes.map((a) => ATTR_FR[a] ?? a).join('/'));
  if (f.levelEq !== undefined) parts.push(`de niveau ${f.levelEq}`);
  if (f.levelMin !== undefined) parts.push(`de niveau ${f.levelMin} ou plus`);
  if (f.levelMax !== undefined) parts.push(`de niveau ${f.levelMax} ou moins`);
  if (f.quoted.length) parts.push(f.quoted.map((q) => `« ${q} »`).join(' ou '));
  let s = parts.join(' ');
  if (f.except.length) s += ` (sauf ${f.except.map((e) => `« ${e} »`).join(', ')})`;
  return s;
}
