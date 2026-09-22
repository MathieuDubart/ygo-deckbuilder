import type { SynCard } from './types';

/**
 * Vrais textes de cartes (YGOPRODeck, anglais officiel) — base des tests du lecteur de
 * textes et du graphe de synergie. Un deck Blue-Eyes "Structure Deck" réaliste.
 */
type Raw = Omit<SynCard, 'category' | 'isExtraDeck' | 'linkVal' | 'archetype'> &
  Partial<Pick<SynCard, 'linkVal' | 'archetype'>>;

const EXTRA = ['fusion', 'synchro', 'xyz', 'link'];
const card = (c: Raw): SynCard => ({
  linkVal: null,
  archetype: null,
  ...c,
  category: c.frameType === 'spell' ? 'SPELL' : c.frameType === 'trap' ? 'TRAP' : 'MONSTER',
  isExtraDeck: EXTRA.some((f) => c.frameType.startsWith(f)),
});

export const BEWD = card({
  id: 89631139,
  name: 'Blue-Eyes White Dragon',
  type: 'Normal Monster',
  frameType: 'normal',
  desc: 'This legendary dragon is a powerful engine of destruction. Virtually invincible, very few have faced this awesome creature and lived to tell the tale.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 8,
  archetype: 'Blue-Eyes',
});

export const SAGE = card({
  id: 8240199,
  name: 'Sage with Eyes of Blue',
  type: 'Tuner Monster',
  frameType: 'effect',
  desc: 'When this card is Normal Summoned: You can add 1 Level 1 LIGHT Tuner from your Deck to your hand, except "Sage with Eyes of Blue". You can discard this card, then target 1 Effect Monster you control; send it to the GY, and if you do, Special Summon 1 "Blue-Eyes" monster from your Deck. You can only use this effect of "Sage with Eyes of Blue" once per turn.',
  race: 'Spellcaster',
  attribute: 'LIGHT',
  level: 1,
});

export const WHITE_STONE_ANCIENTS = card({
  id: 71039903,
  name: 'The White Stone of Ancients',
  type: 'Tuner Monster',
  frameType: 'effect',
  desc: 'During the End Phase, if this card was sent to the GY this turn: You can Special Summon 1 "Blue-Eyes" monster from your Deck.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 1,
  archetype: 'Blue-Eyes',
});

export const WHITE_STONE_LEGEND = card({
  id: 79814787,
  name: 'The White Stone of Legend',
  type: 'Tuner Monster',
  frameType: 'effect',
  desc: 'If this card is sent to the GY: You can add 1 "Blue-Eyes White Dragon" from your Deck to your hand.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 1,
  archetype: 'Blue-Eyes',
});

export const ALTERNATIVE = card({
  id: 38517737,
  name: 'Blue-Eyes Alternative White Dragon',
  type: 'Effect Monster',
  frameType: 'effect',
  desc: 'Cannot be Normal Summoned/Set. Must first be Special Summoned (from your hand) by revealing "Blue-Eyes White Dragon" in your hand. You can only Special Summon "Blue-Eyes Alternative White Dragon" once per turn this way. This card\'s name becomes "Blue-Eyes White Dragon" while it is on the field or in the Graveyard. Once per turn: You can target 1 monster your opponent controls; destroy it. This card cannot attack the turn this effect is activated.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 8,
  archetype: 'Blue-Eyes',
});

export const DICTATOR = card({
  id: 66961194,
  name: 'Dictator of D.',
  type: 'Effect Monster',
  frameType: 'effect',
  desc: 'While you control a "Blue-Eyes" monster, you choose the attack targets for your opponent\'s attacks. You can only use each of the following effects of "Dictator of D." once per turn. You can send 1 "Blue-Eyes White Dragon" from your hand or Deck to the GY; Special Summon this card from your hand. You can discard 1 "Blue-Eyes White Dragon", or 1 card that mentions it, then target 1 "Blue-Eyes" monster in your GY; Special Summon it.',
  race: 'Spellcaster',
  attribute: 'DARK',
  level: 4,
});

export const ABYSS = card({
  id: 64202399,
  name: 'Blue-Eyes Abyss Dragon',
  type: 'Effect Monster',
  frameType: 'effect',
  desc: 'If this card is Special Summoned: You can add 1 Ritual Spell or 1 "Polymerization" from your Deck to your hand. During your End Phase: You can add 1 Level 8 or higher Dragon monster from your Deck to your hand. You can banish this card from your GY; all Level 8 or higher Dragon monsters you control gain 1000 ATK. You can only use each effect of "Blue-Eyes Abyss Dragon" once per turn, and can only activate them while "Blue-Eyes White Dragon" is on your field or in your GY.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 8,
  archetype: 'Blue-Eyes',
});

export const MAJESTY = card({
  id: 2783661,
  name: 'Majesty with Eyes of Blue',
  type: 'Spell Card',
  frameType: 'spell',
  desc: 'Send 1 "Blue-Eyes" monster from your hand or Deck to the GY, then target 1 face-up monster on the field; it cannot attack while it is face-up on the field. You can only activate 1 "Majesty with Eyes of Blue" per turn.',
  race: 'Quick-Play',
  attribute: null,
  level: null,
});

export const TRADE_IN = card({
  id: 38120068,
  name: 'Trade-In',
  type: 'Spell Card',
  frameType: 'spell',
  desc: 'Discard 1 Level 8 monster; draw 2 cards.',
  race: 'Normal',
  attribute: null,
  level: null,
});

export const POLYMERIZATION = card({
  id: 24094653,
  name: 'Polymerization',
  type: 'Spell Card',
  frameType: 'spell',
  desc: 'Fusion Summon 1 Fusion Monster from your Extra Deck, using monsters from your hand or field as Fusion Material.',
  race: 'Normal',
  attribute: null,
  level: null,
});

export const ASH = card({
  id: 14558127,
  name: 'Ash Blossom & Joyous Spring',
  type: 'Tuner Monster',
  frameType: 'effect',
  desc: 'When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect.\r\n● Add a card from the Deck to the hand.\r\n● Special Summon from the Deck.\r\n● Send a card from the Deck to the GY.\r\nYou can only use this effect of "Ash Blossom & Joyous Spring" once per turn.',
  race: 'Zombie',
  attribute: 'FIRE',
  level: 3,
});

export const SPIRIT_DRAGON = card({
  id: 59822133,
  name: 'Blue-Eyes Spirit Dragon',
  type: 'Synchro Monster',
  frameType: 'synchro',
  desc: '1 Tuner + 1 or more non-Tuner "Blue-Eyes" monsters\r\nNeither player can Special Summon 2 or more monsters at the same time. Once per turn, during either player\'s turn, when an effect of a card in the Graveyard is activated: You can negate the activation. During either player\'s turn: You can Tribute this Synchro Summoned card; Special Summon 1 LIGHT Dragon-Type Synchro Monster from your Extra Deck in Defense Position, except "Blue-Eyes Spirit Dragon", but destroy it during the End Phase of this turn.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 9,
});

export const ULTIMATE_SPIRIT = card({
  id: 89604813,
  name: 'Blue-Eyes Ultimate Spirit Dragon',
  type: 'Synchro Monster',
  frameType: 'synchro',
  desc: '2+ Tuners + 1 non-Tuner "Blue-Eyes" monster\r\nYour opponent cannot banish cards from your GY. You can only use each of the following effects of "Blue-Eyes Ultimate Spirit Dragon" once per turn. When a card or effect is activated on the field (Quick Effect): You can negate the activation, and if you do, this card gains 1000 ATK until the end of this turn. If this card is destroyed by battle or card effect: You can Special Summon 1 LIGHT Dragon monster from your GY, except "Blue-Eyes Ultimate Spirit Dragon".',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 12,
});

export const TWIN_BURST = card({
  id: 2129638,
  name: 'Blue-Eyes Twin Burst Dragon',
  type: 'Fusion Monster',
  frameType: 'fusion',
  desc: '"Blue-Eyes White Dragon" + "Blue-Eyes White Dragon"\r\nMust be either Fusion Summoned, or Special Summoned by sending the above monsters you control to the GY (in which case you do not use "Polymerization"). Cannot be destroyed by battle. This card can make up to 2 attacks on monsters during each Battle Phase. At the end of the Damage Step, when this card attacks an opponent\'s monster, but the opponent\'s monster was not destroyed by the battle: You can banish that opponent\'s monster.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 10,
});

export const ULTIMATE = card({
  id: 23995346,
  name: 'Blue-Eyes Ultimate Dragon',
  type: 'Fusion Monster',
  frameType: 'fusion',
  desc: '"Blue-Eyes White Dragon" + "Blue-Eyes White Dragon" + "Blue-Eyes White Dragon"',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 12,
});

export const TITANIC = card({
  id: 63767246,
  name: 'Number 38: Hope Harbinger Dragon Titanic Galaxy',
  type: 'XYZ Monster',
  frameType: 'xyz',
  desc: '2 Level 8 monsters\r\nOnce per turn, when a Spell Card or effect is activated on the field (Quick Effect): You can negate that activation, and if you do, attach that card to this card as material.',
  race: 'Dragon',
  attribute: 'LIGHT',
  level: 8,
});

export const LINKURIBOH = card({
  id: 41999284,
  name: 'Linkuriboh',
  type: 'Link Monster',
  frameType: 'link',
  desc: "1 Level 1 monster\r\nWhen an opponent's monster declares an attack: You can Tribute this card; change that opponent's monster's ATK to 0, until the end of this turn.",
  race: 'Cyberse',
  attribute: 'DARK',
  level: null,
  linkVal: 1,
});

/** Rank 7 impossible à monter dans ce deck (aucun monstre de niveau 7) */
export const RANK7 = card({
  id: 80117527,
  name: 'Number 11: Big Eye',
  type: 'XYZ Monster',
  frameType: 'xyz',
  desc: '2 Level 7 monsters\r\nOnce per turn: You can detach 1 material from this card, then target 1 monster your opponent controls; take control of it. This card cannot attack during the turn you activate this effect.',
  race: 'Spellcaster',
  attribute: 'DARK',
  level: 7,
});

export const BLUE_EYES_DECK: { card: SynCard; qty: number }[] = [
  { card: BEWD, qty: 3 },
  { card: SAGE, qty: 3 },
  { card: WHITE_STONE_ANCIENTS, qty: 2 },
  { card: WHITE_STONE_LEGEND, qty: 2 },
  { card: ALTERNATIVE, qty: 3 },
  { card: DICTATOR, qty: 3 },
  { card: ABYSS, qty: 2 },
  { card: MAJESTY, qty: 2 },
  { card: TRADE_IN, qty: 2 },
  { card: POLYMERIZATION, qty: 1 },
  { card: ASH, qty: 3 },
  { card: SPIRIT_DRAGON, qty: 1 },
  { card: ULTIMATE_SPIRIT, qty: 1 },
  { card: TWIN_BURST, qty: 1 },
  { card: ULTIMATE, qty: 1 },
  { card: TITANIC, qty: 1 },
  { card: LINKURIBOH, qty: 1 },
  { card: RANK7, qty: 1 },
];
