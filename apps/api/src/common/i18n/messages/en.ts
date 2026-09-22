/**
 * Textes générés par l'API — anglais (référence : toutes les clés existent ici).
 * `{param}` est remplacé ; { one, other } = pluriel. Les autres langues peuvent être
 * partielles : une clé manquante retombe sur l'anglais.
 */
export const en = {
  format: { quote: '“{text}”' },

  duel: {
    errors: {
      disabled: 'The duel simulator is disabled on this server.',
      notReady: 'The duel simulator is downloading card scripts, try again in a minute.',
      engine: 'The duel engine stopped unexpectedly.',
      invalidResponse: 'This choice is not possible right now.',
      notFound: 'Duel not found or expired.',
      emptyDeck: 'This deck has no Main Deck card the simulator knows.',
    },
  },

  errors: {
    emailTaken: 'Email already in use',
    usernameTaken: 'Username already taken',
    validation: 'Validation failed',
    sessionExpired: 'Session expired',
    badCredentials: 'Wrong email or password',
    cardNotFound: 'Card not found',
    deckNotFound: 'Deck not found',
    metaDeckNotFound: 'Meta deck not found',
    officialDeckNotFound: 'Official deck not found',
    productNotFound: 'Product not found',
    productNotOwned: 'Product not found in your collection',
    productEmpty: 'This product contains no known card',
    printMismatch: 'This print does not match the card',
    invalidPrint: 'Invalid print',
    invalidDeck: 'Invalid deck',
    ydkEmpty: 'Empty or invalid .ydk file',
    ydkNoCards: 'No card recognized in this .ydk',
    unknownCards: 'Unknown card(s) in the decklist',
    archetypeNotOwned: 'No “{archetype}” card in your collection',
    syncRunning: 'A synchronization is already running',
    metaSyncRunning: 'Meta update already running',
    syncFailed: 'Synchronization failed: {message}',
  },

  validation: {
    required: 'Required',
    invalid: 'Invalid value',
    minChars: 'At least {min} characters',
    maxChars: '{max} characters maximum',
    min: 'Minimum {min}',
    max: 'Maximum {max}',
    email: 'Invalid email address',
    pattern: 'Letters, numbers, _ and - only',
    format: 'Invalid format',
  },

  generator: {
    ownedName: '{name} (my collection)',
    officialBasedOn: 'Official list of “{name}” (Yugipedia).',
    autoName: '{name} (auto)',
    composition:
      'Composition: {engine} engine cards, {staples} staples, {fillers} generic fillers.',
    incomplete: {
      one: '{count} card missing to reach 40 with your collection: switch to the full list to see what to buy.',
      other:
        '{count} cards missing to reach 40 with your collection: switch to the full list to see what to buy.',
    },
    fragile:
      'Complete but fragile: too many generic cards compared to the engine. Strengthen the archetype to make it really playable.',
    basedOn: {
      one: 'Based on {count} recent tournament list.',
      other: 'Based on {count} recent tournament lists.',
    },
    metaVersion: 'A tournament version exists: “{name}” in the meta decks.',
  },

  mechanics: {
    FUSION: 'Fusion',
    SYNCHRO: 'Synchro',
    XYZ: 'Xyz',
    LINK: 'Link',
    RITUAL: 'Ritual',
  },

  styles: {
    ritual: 'Ritual',
    combo: 'Combo',
    control: 'Control',
    graveyard: 'Graveyard',
    handTraps: 'Hand traps',
    beatdown: 'Beatdown',
    midrange: 'Midrange',
  },

  roles: {
    STARTER: 'Starter',
    SEARCHER: 'Searcher',
    EXTENDER: 'Extender',
    HAND_TRAP: 'Hand trap',
    INTERRUPTION: 'Interruption',
    REMOVAL: 'Removal',
    DRAW: 'Draw',
    RECOVERY: 'Recovery',
    FUSION_ENABLER: 'Fusion',
    RITUAL_ENABLER: 'Ritual',
    BOSS: 'Boss',
  },

  guide: {
    summary: {
      style: '{styles} deck',
      styleArchetype: '{styles} deck built around {archetype}.',
      styleOnly: '{styles} deck.',
      bosses: 'It aims to put {bosses} on the field from the Extra Deck.',
      noBoss: 'It mostly plays from its Main Deck (little usable Extra Deck).',
      starters:
        'With {count} starters, you open with one {odds5} of the time ({odds6} going second).',
      noStarter: 'No clear starter: the deck may open without being able to do anything.',
      unreadable:
        'The effects of {subject} could not be analyzed automatically (missing texts or wording not recognized yet). The guide sticks to the basics: rely on the card texts.',
      unreadableArchetype: 'these {archetype} cards',
      unreadableDeck: 'this deck',
    },
    stats: {
      starters: {
        label: 'Starters',
        hint: 'Cards that start your plays on their own. Opening hand with at least one starter: {odds}.',
      },
      extenders: {
        label: 'Extenders',
        hint: 'Cards that extend a combo (summon themselves, revive…): useful when the starter gets stopped.',
      },
      handTraps: {
        label: 'Hand traps',
        hint: 'Interruptions you can play from the hand during the opponent’s turn.',
      },
      extra: {
        label: 'Summonable Extra',
        hint: 'Extra Deck monsters you can actually summon with the Main Deck’s materials.',
      },
      linked: {
        label: 'Linked cards',
        hint: 'Share of the Main Deck that searches, summons or is searched/summoned by another card of the deck.',
      },
      interactions: {
        label: 'Interactions',
        hint: 'Negations and removal (hand traps excluded) to deal with the opponent’s board.',
      },
    },
    plan: {
      starters:
        'Try to open with a starter: {cards}. They search or summon the rest of the engine from the Deck.',
      chain: 'Key search chain: {a} searches {b}, which in turn searches {c}.',
      gyTrigger: '{card} does nothing in hand: its effect triggers in the GY. Send it with {how}.',
      asMaterial: 'using it as Summoning material',
      endBoard: 'End-of-turn goal: {boss} ({mechanic}).',
      endBoardWith: 'End-of-turn goal: {boss} ({mechanic}), for example with {materials}.',
      draw: 'Draw cards ({cards}) help you dig for your starters: play them early in the turn.',
    },
    first: {
      combo: 'Run your combo up to {bosses} and keep something to interrupt the opponent’s turn.',
      negaters: {
        one: '{cards} can negate: that’s your real wall, favor the lines that lead to it.',
        other: '{cards} can negate: that’s your real wall, favor the lines that lead to them.',
      },
      traps: {
        one: 'Set your trap ({count} in the deck) at the end of the turn: it only works once set.',
        other:
          'Set your traps ({count} in the deck) at the end of the turn: they only work once set.',
      },
      handTrapCheck:
        'Before starting, spot which opponent card (hand trap) could cut your combo and start with the effect you can best afford to lose.',
    },
    second: {
      handTraps:
        'Your hand traps ({cards}) are played during the opponent’s turn: keep them for the effect that starts their combo (search, summon from the Deck).',
      removal: 'To break the opponent’s board: {cards}. Target the negating monster first.',
      noRemoval:
        'The deck lacks cards to break a board: consider generic “board breakers” (Raigeki, Dark Ruler No More, Evenly Matched…).',
      extraDraw:
        'You draw one more card: don’t hold back on your combo, the opponent has already used part of their resources.',
    },
    mistakes: {
      normalSummon:
        '{cards} all need your Normal Summon: with two of them in hand, pick the one that leads to the best combo, the other will wait.',
      oncePerTurn:
        '{cards}: effect usable once per turn. Having two in hand doesn’t double the effect, keep the 2nd copy for the next turn.',
      freeFirst:
        'Play first the cards that don’t cost your Normal Summon (spells, monsters that summon themselves), then decide what to Normal Summon.',
      gyTriggers: 'Don’t Normal Summon {cards}: their effect only works once sent to the GY.',
      handTrapTiming:
        'Don’t fire a hand trap at the opponent’s first card: wait for the effect that really matters (often the 2nd or 3rd activation).',
      brick:
        '{card} is hard to summon and nothing searches it: in an opening hand it is often a dead card. Consider playing fewer or cutting it.',
      unreachable:
        '{card} can’t be summoned with this Main Deck’s materials: it wastes a slot in the Extra Deck.',
      fewStarters: 'Few starters: if you can, go up to 3 copies of {cards} to open more often.',
    },
    combo: {
      alone: '{card} alone',
    },
    explain: {
      SEARCH: 'searches {cards}',
      SPECIAL_SUMMON: 'summons {cards}',
      SEND_GY: 'sends {cards} to the GY',
      RECOVER: 'recovers {cards}',
      accessible: 'reachable through {cards}',
      selfSummon: 'summons itself',
      handTrap: 'is played from the hand during the opponent’s turn',
      negates: 'can negate an activation',
      removal: 'destroys or removes an opponent’s card',
      draws: 'draws cards',
      summonableWith: 'summonable with {cards}',
      extraOption: 'Extra Deck option.',
      support: 'Support card.',
    },
    steps: {
      NORMAL_SUMMON: 'Normal Summon {card}.',
      SPECIAL_SUMMON_SELF: 'Special Summon {card} with its own effect.',
      ACTIVATE: 'Activate {card}.',
      DISCARD: 'Discard {card} to activate its effect.',
      SEARCH: '{card} adds {target} to your hand.',
      SPECIAL_SUMMON: '{card} Special Summons {target}.',
      SEND_GY: '{card} sends {target} to the GY.',
      EXTRA_SUMMON: '{mechanic} Summon {card}.',
      EXTRA_SUMMON_WITH: '{mechanic} Summon {card} using {materials}.',
      END_PHASE: 'During the End Phase, {card} (in the GY) brings {target} from the Deck.',
    },
  },

  interactions: {
    noun: {
      tuner: 'Tuner',
      nonTuner: 'non-Tuner',
      SPELL: 'Spell',
      TRAP: 'Trap',
      SPELL_TRAP: 'Spell/Trap',
      MONSTER: 'monster',
      card: 'card',
    },
    attributes: {
      LIGHT: 'LIGHT',
      DARK: 'DARK',
      EARTH: 'EARTH',
      WATER: 'WATER',
      FIRE: 'FIRE',
      WIND: 'WIND',
      DIVINE: 'DIVINE',
    },
    /** Ordre des morceaux dans la langue (les vides sont retirés) */
    pattern: '{level} {attributes} {races} {names} {subtypes} {noun}',
    levelEq: 'Level {level}',
    levelMin: 'Level {level} or higher',
    levelMax: 'Level {level} or lower',
    or: 'or',
    except: '(except {names})',
  },

  ai: {
    language: 'English',
    errors: {
      unusable: 'The model gave an unusable answer ({path}: {message}).',
      empty: 'The model gave an empty answer.',
      timeout: 'no answer within {seconds} s (raise AI_TIMEOUT_MS for a slow local model)',
      unreachable: 'server unreachable ({url}) — is the model server running?',
      unavailable: 'AI unavailable: {message}',
    },
  },
};

export type Messages = typeof en;
