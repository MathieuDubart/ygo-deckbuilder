import type {
  CardAction,
  CardFeatures,
  CardFilter,
  Location,
  Materials,
  SynCard,
  Verb,
} from './types';

/**
 * Lecture des textes de cartes (anglais officiel, format "PSCT" de Konami).
 * Le PSCT est très régulier ("add 1 X from your Deck to your hand", "Special Summon 1 X
 * from your hand or GY"…) : quelques expressions régulières couvrent l'essentiel des
 * interactions. Ce n'est pas un moteur de règles complet, c'est un lecteur d'intentions.
 */

const RACES = [
  'Aqua',
  'Beast-Warrior',
  'Beast',
  'Creator-God',
  'Cyberse',
  'Dinosaur',
  'Divine-Beast',
  'Dragon',
  'Fairy',
  'Fiend',
  'Fish',
  'Illusion',
  'Insect',
  'Machine',
  'Plant',
  'Psychic',
  'Pyro',
  'Reptile',
  'Rock',
  'Sea Serpent',
  'Spellcaster',
  'Thunder',
  'Warrior',
  'Winged Beast',
  'Wyrm',
  'Zombie',
];
const ATTRIBUTES = ['LIGHT', 'DARK', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];
const SUBTYPES = [
  'Ritual',
  'Fusion',
  'Synchro',
  'Xyz',
  'Link',
  'Pendulum',
  'Normal',
  'Effect',
  'Quick-Play',
  'Continuous',
  'Field',
  'Equip',
  'Counter',
  'Flip',
  'Gemini',
  'Spirit',
  'Toon',
  'Union',
];
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };

const num = (s: string | undefined): number => {
  if (!s) return 1;
  const n = Number(s);
  return Number.isFinite(n) ? n : (NUMBERS[s.toLowerCase()] ?? 1);
};

const emptyFilter = (): CardFilter => ({
  quoted: [],
  except: [],
  kinds: [],
  subtypes: [],
  races: [],
  attributes: [],
});

/**
 * "1 Level 1 LIGHT Tuner", "1 "Blue-Eyes" monster", "1 Ritual Spell or 1 "Polymerization"",
 * "1 Level 8 or higher Dragon monster, except "X"" → un ou plusieurs filtres (OU).
 */
export function parseFilters(phrase: string): CardFilter[] {
  let p = phrase.trim();
  const except: string[] = [];
  p = p.replace(
    /,?\s*(?:except|other than) ((?:"[^"]+"(?:,? (?:or|and) )?)+)/gi,
    (_, names: string) => {
      for (const m of names.matchAll(/"([^"]+)"/g)) except.push(m[1]!);
      return '';
    },
  );
  // alternatives : "1 Ritual Spell or 1 "Polymerization"" / "1 "X" monster or 1 "Y" Spell"
  const parts = p.split(/\s+or\s+(?=\d|"|a |an )/i);
  return parts.map((part) => ({ ...parseOne(part), except }));
}

function parseOne(raw: string): CardFilter {
  const f = emptyFilter();
  let s = raw;
  s = s.replace(/"([^"]+)"/g, (_, q: string) => {
    f.quoted.push(q);
    return ' ';
  });
  const lvMax = /Level (\d+) or lower/i.exec(s);
  const lvMin = /Level (\d+) or higher/i.exec(s);
  const lvEq = /Level (\d+)(?! or)/i.exec(s);
  if (lvMax) f.levelMax = Number(lvMax[1]);
  else if (lvMin) f.levelMin = Number(lvMin[1]);
  else if (lvEq) f.levelEq = Number(lvEq[1]);

  for (const a of ATTRIBUTES) if (new RegExp(`\\b${a}\\b`).test(s)) f.attributes.push(a);
  for (const r of RACES) {
    if (new RegExp(`\\b${r}(?:-Type)?\\b`, 'i').test(s)) f.races.push(r);
  }
  if (/\bnon-Tuners?\b/i.test(s)) f.nonTuner = true;
  else if (/\bTuners?\b/i.test(s)) f.tuner = true;

  if (/Spell\/Trap/i.test(s)) f.kinds.push('SPELL', 'TRAP');
  else {
    if (/\bSpells?\b/i.test(s)) f.kinds.push('SPELL');
    if (/\bTraps?\b/i.test(s)) f.kinds.push('TRAP');
  }
  if (/\bmonsters?\b/i.test(s) || f.tuner || f.nonTuner || f.levelEq || f.levelMax || f.levelMin) {
    f.kinds.push('MONSTER');
  }
  for (const t of SUBTYPES) if (new RegExp(`\\b${t}\\b`).test(s)) f.subtypes.push(t);
  // "Beast" est aussi un préfixe de "Beast-Warrior" : on garde le plus précis
  if (f.races.includes('Beast-Warrior')) f.races = f.races.filter((r) => r !== 'Beast');
  if (f.races.includes('Winged Beast')) f.races = f.races.filter((r) => r !== 'Beast');
  return f;
}

/** "from your hand, Deck, or GY" → [HAND, DECK, GY] */
function parseLocations(s: string): Location[] {
  const locs: Location[] = [];
  if (/\bhand\b/i.test(s)) locs.push('HAND');
  if (/\bDeck\b/.test(s.replace(/Extra Deck/g, ''))) locs.push('DECK');
  if (/Extra Deck/.test(s)) locs.push('EXTRA');
  if (/\b(GY|Graveyard)\b/i.test(s)) locs.push('GY');
  if (/banish(ed|ment)/i.test(s)) locs.push('BANISHED');
  return [...new Set(locs)];
}

// "from your Deck" = ses propres cartes ; "from the Deck" = description générique (listes à puces d'Ash Blossom…)
const LOC = String.raw`your ((?:hand|Deck|Extra Deck|GY|Graveyard|banishment)(?:(?:,| or| and\/or|,? or) (?:your )?(?:hand|Deck|Extra Deck|GY|Graveyard|banishment))*)`;

const ACTION_PATTERNS: { verb: Verb; re: RegExp }[] = [
  // add 1 "X" monster from your Deck to your hand / add up to 2 "X" monsters with different names from your Deck
  {
    verb: 'SEARCH',
    re: new RegExp(
      String.raw`add (up to )?(\d+|one|two|a|an) (.+?) from ${LOC} to your hand`,
      'gi',
    ),
  },
  // Special Summon 1 "X" monster from your hand, Deck, or GY
  {
    verb: 'SPECIAL_SUMMON',
    re: new RegExp(
      String.raw`Special Summon (?:up to )?(\d+|one|two|three|a|an)?\s*(?:copies of )?(.+?) from ${LOC}`,
      'gi',
    ),
  },
  // send 1 "Blue-Eyes" monster from your hand or Deck to the GY
  {
    verb: 'SEND_GY',
    re: new RegExp(String.raw`send (\d+|one|a|an) (.+?) from ${LOC} to the (?:GY|Graveyard)`, 'gi'),
  },
];

/**
 * Déclencheur et coût d'un effet, lus dans le début de sa phrase :
 * "When this card is Normal Summoned: You can add…" → NS ; "You can discard this card, then…" → depuis la main.
 */
function context(text: string, index: number): Pick<CardAction, 'trigger' | 'fromHand'> {
  const before = text.slice(0, index);
  const start = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('\n'),
    before.lastIndexOf('.)'),
  );
  const sentence = before.slice(start + 1);
  const fromHand = /discard this card|reveal this card in your hand/i.test(sentence);
  let trigger: CardAction['trigger'] = 'IGNITION';
  if (/End Phase/i.test(sentence) && /sent to the (?:GY|Graveyard)/i.test(sentence))
    trigger = 'END_PHASE_GY';
  else if (/End Phase/i.test(sentence)) trigger = 'END_PHASE';
  else if (/sent to the (?:GY|Graveyard)/i.test(sentence) && /this card/i.test(sentence))
    trigger = 'SENT_GY';
  else if (/Normal or Special Summoned/i.test(sentence)) trigger = 'NS_OR_SS';
  else if (/this card is Normal Summoned/i.test(sentence)) trigger = 'NS';
  else if (/this card is Special Summoned/i.test(sentence)) trigger = 'SS';
  return { trigger, fromHand };
}

/** Analyse le texte d'une carte. Pur et déterministe : mis en cache par l'appelant. */
export function parseCard(card: SynCard): CardFeatures {
  const desc = card.desc.replace(/\r/g, '');
  const isMaterialCard = /^(fusion|synchro|xyz|link)/.test(card.frameType);
  const [firstLine, ...rest] = desc.split('\n');
  const effectText = isMaterialCard ? rest.join('\n') : desc;

  const actions: CardAction[] = [];
  for (const { verb, re } of ACTION_PATTERNS) {
    for (const m of effectText.matchAll(re)) {
      const isSearch = verb === 'SEARCH';
      const count = num(isSearch ? m[2] : m[1]);
      const phrase = isSearch ? m[3]! : m[2]!;
      const from = parseLocations(isSearch ? m[4]! : m[3]!);
      if (/^this card\b|^it\b|^them\b|^that monster\b/i.test(phrase.trim())) continue;
      const filters = parseFilters(phrase.replace(/ with different names/i, ''));
      actions.push({
        verb: verb === 'SPECIAL_SUMMON' && from.includes('EXTRA') ? 'SUMMON_EXTRA' : verb,
        from,
        filters,
        count,
        ...context(effectText, m.index ?? 0),
      });
    }
  }
  // "target 1 Level 1 LIGHT Tuner in your GY; add it to your hand" → récupération
  for (const m of effectText.matchAll(
    /target (\d+|one|a|an) (.+?) in your (?:GY|Graveyard)[^.]*?;\s*(add it to your hand|Special Summon it)/gi,
  )) {
    actions.push({
      verb: /Special Summon/i.test(m[3]!) ? 'SPECIAL_SUMMON' : 'RECOVER',
      from: ['GY'],
      filters: parseFilters(m[2]!),
      count: num(m[1]),
      ...context(effectText, m.index ?? 0),
    });
  }

  const mentions = [...new Set([...desc.matchAll(/"([^"]+)"/g)].map((m) => m[1]!))].filter(
    (n) => n !== card.name,
  );
  const treatedAs = [...desc.matchAll(/always treated as an? "([^"]+)" card/gi)].map((m) => m[1]!);
  // "This card's name becomes "Blue-Eyes White Dragon" while it is on the field" : pas dans le Deck
  const fieldNames = [...desc.matchAll(/name becomes "([^"]+)"/gi)].map((m) => m[1]!);
  const monster = card.category === 'MONSTER';

  return {
    id: card.id,
    actions,
    selfSummon: /Special Summon this card\b/i.test(effectText),
    cannotNormalSummon: /Cannot be Normal Summoned/i.test(desc),
    normalSummonTrigger: /(?:When|If) this card is Normal(?: or Special)? Summoned/i.test(
      effectText,
    ),
    sentToGyTrigger:
      /(?:If|When) this card is sent to the (?:GY|Graveyard)|if this card was sent to the (?:GY|Graveyard)/i.test(
        effectText,
      ),
    discardIgnition: /You can discard this card[;,]/i.test(effectText),
    handTrap:
      monster &&
      !card.isExtraDeck &&
      /\(Quick Effect\)/i.test(effectText) &&
      /(You can discard this card|send this card from your hand|reveal this card in your hand|Special Summon this card from your hand)/i.test(
        effectText,
      ),
    negates:
      /\bnegate (?:the activation|that effect|its effects|the effects|that (?:card|monster)|the Summon|the attack)/i.test(
        effectText,
      ),
    removal:
      /(?:destroy|banish|return|shuffle|send)[^.;]{0,60}(?:your opponent controls|your opponent's|opponent's (?:field|hand|GY))/i.test(
        effectText,
      ) ||
      // "target 1 monster your opponent controls; destroy it"
      /target [^;]{0,60}(?:your opponent controls|your opponent's)[^;]*;\s*(?:destroy|banish|return|shuffle|send|negate)/i.test(
        effectText,
      ) ||
      /Destroy all monsters your opponent controls/i.test(effectText),
    draws: /\bdraw (\d+|one|two) cards?/i.test(effectText),
    tuner: /\bTuner\b/.test(card.type),
    oncePerTurn:
      /You can only (?:use|activate) (?:each|this|1|one)[^.]*?(?:once per turn|per turn)/i.test(
        desc,
      ) || /You can only (?:Special Summon|activate 1) "[^"]+"[^.]*per turn/i.test(desc),
    fusionEnabler:
      /Fusion Summon (?:1|one|a)\b/i.test(effectText) || card.name === 'Polymerization',
    ritualEnabler: card.race === 'Ritual' && card.category === 'SPELL',
    mentions,
    treatedAs,
    fieldNames,
    materials: isMaterialCard ? parseMaterials(card, firstLine ?? '') : undefined,
  };
}

/** Première ligne d'un monstre Extra Deck : ses matériaux. */
export function parseMaterials(card: SynCard, line: string): Materials | undefined {
  const frame = card.frameType.split('_')[0];
  const exotic =
    /Xyz Monster|Link Monster|Synchro Monster|Fusion Monster/.test(line) && frame !== 'fusion';

  if (frame === 'xyz') {
    const m = /^(\d+)\+?\s+Level (\d+) (.*?)monsters?/i.exec(line);
    if (!m) return { mechanic: 'XYZ', parts: [], exotic: true };
    const filter = parseFilters(m[3] ?? '')[0]!;
    filter.kinds = ['MONSTER'];
    return { mechanic: 'XYZ', parts: [], count: Number(m[1]), level: Number(m[2]), filter, exotic };
  }

  if (frame === 'synchro') {
    const m =
      /^(\d+)\+?\s+(.*?)Tuners?(?: monsters?)?\s*\+\s*(\d+)(?:\+| or more)?\s+non-Tuner (.*?)monsters?/i.exec(
        line,
      );
    if (!m) return { mechanic: 'SYNCHRO', parts: [], exotic: true };
    const tuner = parseFilters(m[2] ?? '')[0]!;
    tuner.tuner = true;
    tuner.kinds = ['MONSTER'];
    const non = parseFilters(m[4] ?? '')[0]!;
    non.kinds = ['MONSTER'];
    return {
      mechanic: 'SYNCHRO',
      parts: [],
      level: card.level ?? undefined,
      tuner: { filter: tuner, count: Number(m[1]) },
      nonTuner: { filter: non, min: Number(m[3]) },
      exotic,
    };
  }

  if (frame === 'link') {
    const m = /^(\d+)\+?\s+(.*?)(?:monsters?|Monsters?)\b(.*)$/i.exec(line);
    if (!m) return { mechanic: 'LINK', parts: [], exotic: true };
    const filter = parseFilters(`${m[2] ?? ''} monster`)[0]!;
    filter.kinds = ['MONSTER'];
    const including = /including (?:a|an|1) (.+?)$/i.exec(m[3] ?? '');
    return {
      mechanic: 'LINK',
      parts: including ? [{ filter: parseFilters(including[1]!)[0]!, count: 1 }] : [],
      count: Number(m[1]),
      filter,
      exotic,
    };
  }

  if (frame === 'fusion') {
    const parts = line.split(/\s*\+\s*/).map((p) => {
      const count = /^(\d+)\+?\s/.exec(p);
      return { filter: parseFilters(p)[0]!, count: count ? Number(count[1]) : 1 };
    });
    return { mechanic: 'FUSION', parts, exotic: false };
  }
  return undefined;
}

// ─── Correspondance carte ⇄ filtre ───────────────────────────────────────────

/** Une carte répond-elle à la condition d'un effet ? */
export function matches(
  card: SynCard,
  f: CardFilter,
  features?: CardFeatures,
  /** Où la carte est cherchée : un nom "sur le terrain / au cimetière" ne compte pas dans le Deck */
  from?: Location[],
): boolean {
  const onFieldOrGy = !from || from.some((l) => l === 'GY' || l === 'FIELD');
  if (f.except.includes(card.name)) return false;
  if (f.kinds.length && !f.kinds.includes(card.category as 'MONSTER')) return false;
  if (f.quoted.length) {
    const names = [
      card.name,
      card.archetype ?? '',
      ...(features?.treatedAs ?? []),
      ...(onFieldOrGy ? (features?.fieldNames ?? []) : []),
    ];
    const ok = f.quoted.some(
      (q) =>
        names.includes(q) ||
        card.name.includes(q) ||
        (card.archetype ?? '').toLowerCase() === q.toLowerCase(),
    );
    if (!ok) return false;
  }
  if (f.attributes.length && !f.attributes.includes(card.attribute ?? '')) return false;
  if (f.races.length && !f.races.some((r) => (card.race ?? '').toLowerCase() === r.toLowerCase()))
    return false;
  const level = card.level ?? -1;
  if (f.levelEq !== undefined && level !== f.levelEq) return false;
  if (f.levelMax !== undefined && (level < 0 || level > f.levelMax)) return false;
  if (f.levelMin !== undefined && level < f.levelMin) return false;
  const isTuner = /\bTuner\b/.test(card.type);
  if (f.tuner && !isTuner) return false;
  if (f.nonTuner && isTuner) return false;
  for (const t of f.subtypes) {
    const inType = new RegExp(`\\b${t}\\b`).test(card.type) || card.race === t;
    // "Effect Monster" couvre tous les monstres à effet (y compris Tuner, Synchro…)
    if (t === 'Effect' && card.category === 'MONSTER' && card.frameType !== 'normal') continue;
    if (!inType) return false;
  }
  return true;
}
