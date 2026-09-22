/** Données de carte nécessaires à l'analyse (texte EN officiel, format PSCT de Konami). */
export interface SynCard {
  id: number;
  name: string;
  desc: string;
  type: string; // "Tuner Monster", "Synchro Monster", "Quick-Play Spell Card"…
  frameType: string; // effect, normal, fusion, synchro, xyz, link, ritual, spell, trap (+ _pendulum)
  category: 'MONSTER' | 'SPELL' | 'TRAP' | 'SKILL' | 'TOKEN';
  race: string | null; // Dragon, Spellcaster… ou sous-type de magie/piège (Quick-Play, Ritual…)
  attribute: string | null;
  level: number | null; // niveau ou rang
  linkVal: number | null;
  archetype: string | null;
  isExtraDeck: boolean;
}

export type Location = 'DECK' | 'HAND' | 'GY' | 'BANISHED' | 'EXTRA' | 'FIELD';

/** Condition sur les cartes visées par un effet ("1 Level 1 LIGHT Tuner", "1 "Blue-Eyes" monster"…). */
export interface CardFilter {
  /** Noms ou archétypes entre guillemets (l'un OU l'autre suffit) */
  quoted: string[];
  except: string[];
  kinds: ('MONSTER' | 'SPELL' | 'TRAP')[];
  /** Sous-type : Ritual, Quick-Play, Field, Equip, Continuous… ou type de monstre spécial */
  subtypes: string[];
  races: string[];
  attributes: string[];
  levelEq?: number;
  levelMin?: number;
  levelMax?: number;
  tuner?: boolean;
  nonTuner?: boolean;
}

export type Verb = 'SEARCH' | 'SPECIAL_SUMMON' | 'SEND_GY' | 'RECOVER' | 'SUMMON_EXTRA';

/** Ce qui déclenche l'effet, lu dans le début de la phrase ("When this card is Normal Summoned: …"). */
export type Trigger =
  'NS' | 'SS' | 'NS_OR_SS' | 'SENT_GY' | 'END_PHASE_GY' | 'END_PHASE' | 'IGNITION';

export interface CardAction {
  verb: Verb;
  from: Location[];
  filters: CardFilter[];
  count: number;
  trigger: Trigger;
  /** Coût "discard this card" : l'effet s'active depuis la main */
  fromHand: boolean;
}

export type Role =
  | 'STARTER' // lance le jeu seul : cherche ou invoque depuis le Deck
  | 'SEARCHER'
  | 'EXTENDER' // s'invoque tout seul ou invoque depuis la main/le cimetière
  | 'HAND_TRAP'
  | 'INTERRUPTION'
  | 'REMOVAL'
  | 'DRAW'
  | 'RECOVERY'
  | 'FUSION_ENABLER'
  | 'RITUAL_ENABLER'
  | 'BOSS';

export type SummonMechanic = 'FUSION' | 'SYNCHRO' | 'XYZ' | 'LINK' | 'RITUAL';

export interface Materials {
  mechanic: SummonMechanic;
  /** Fusion : matériaux listés (nom exact ou filtre), avec leur nombre */
  parts: { filter: CardFilter; count: number }[];
  /** Synchro : syntoniseur(s) + non-syntoniseur(s) */
  tuner?: { filter: CardFilter; count: number };
  nonTuner?: { filter: CardFilter; min: number };
  /** Xyz : N monstres de même niveau / Link : N monstres */
  count?: number;
  /** Xyz / Link : condition sur les matériaux ("LIGHT", "Effect", "Level 1"…) */
  filter?: CardFilter;
  level?: number;
  /** Nécessite déjà un monstre Xyz/Link… (rank-up, etc.) : on ne sait pas le monter depuis le Main */
  exotic?: boolean;
}

export interface CardFeatures {
  id: number;
  actions: CardAction[];
  /** "Special Summon this card" : s'invoque tout seul (main ou cimetière) */
  selfSummon: boolean;
  /** "Cannot be Normal Summoned/Set" */
  cannotNormalSummon: boolean;
  /** Effet déclenché par son Invocation Normale */
  normalSummonTrigger: boolean;
  /** Effet déclenché quand elle est envoyée au cimetière (a besoin d'un "enabler") */
  sentToGyTrigger: boolean;
  /** Effet activé en se défaussant ("You can discard this card; …") */
  discardIgnition: boolean;
  handTrap: boolean;
  negates: boolean;
  removal: boolean;
  draws: boolean;
  tuner: boolean;
  /** Effet(s) limité(s) à 1 fois par tour ("hard once per turn") */
  oncePerTurn: boolean;
  fusionEnabler: boolean;
  ritualEnabler: boolean;
  /** Noms/archétypes cités entre guillemets */
  mentions: string[];
  /** Traitée comme une carte "X" ("This card is always treated as a "X" card") */
  treatedAs: string[];
  /** Nom pris sur le terrain / au cimetière ("This card's name becomes "X" while…") */
  fieldNames: string[];
  materials?: Materials;
}
