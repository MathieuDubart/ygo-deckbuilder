import { featuresOf } from './graph';
import type { Translator } from '../../../common/i18n/translator';
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

// ─── Description d'un filtre dans la langue ──────────────────────────────────

/**
 * « Syntoniseur LUMIÈRE de niveau 1 », « Level 1 LIGHT Tuner », « monstre « Blue-Eyes » »…
 * L'ordre des morceaux dépend de la langue (clé interactions.pattern).
 */
export function describeFilter(f: CardFilter, tr: Translator): string {
  const { t } = tr;
  const kind = f.kinds.length === 1 ? f.kinds[0] : f.kinds.length > 1 ? 'SPELL_TRAP' : null;
  const nounKey = f.tuner ? 'tuner' : f.nonTuner ? 'nonTuner' : (kind ?? 'card');
  // Un nom cité sans type (« "Blue-Eyes White Dragon" ») se suffit à lui-même
  const noun = nounKey === 'card' && f.quoted.length ? '' : t(`interactions.noun.${nounKey}`);
  const level =
    f.levelEq !== undefined
      ? t('interactions.levelEq', { level: f.levelEq })
      : f.levelMin !== undefined
        ? t('interactions.levelMin', { level: f.levelMin })
        : f.levelMax !== undefined
          ? t('interactions.levelMax', { level: f.levelMax })
          : '';
  const text = t('interactions.pattern', {
    noun,
    subtypes: f.subtypes.filter((s) => s !== 'Effect').join('/'),
    races: f.races.join('/'),
    attributes: f.attributes.map((a) => t(`interactions.attributes.${a}`)).join('/'),
    level,
    names: f.quoted.map(tr.quote).join(` ${t('interactions.or')} `),
  })
    .replace(/\s+/g, ' ')
    .trim();
  return f.except.length
    ? `${text} ${t('interactions.except', { names: f.except.map(tr.quote).join(', ') })}`
    : text;
}
