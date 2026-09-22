import type { DeepPartialMessages } from './types';

/** Texte der API – Deutsch (informell, „du“). Fehlende Schlüssel fallen auf Englisch zurück. */
export const de: DeepPartialMessages = {
  format: { quote: '„{text}“' },

  duel: {
    errors: {
      disabled: 'Der Duell-Simulator ist auf diesem Server deaktiviert.',
      notReady: 'Der Simulator lädt die Kartenskripte herunter, versuch es in einer Minute erneut.',
      engine: 'Die Duell-Engine wurde unerwartet beendet.',
      invalidResponse: 'Diese Wahl ist gerade nicht möglich.',
      notFound: 'Duell nicht gefunden oder abgelaufen.',
      emptyDeck: 'Dieses Deck hat keine Main-Deck-Karte, die der Simulator kennt.',
    },
  },

  errors: {
    emailTaken: 'E-Mail-Adresse wird bereits verwendet',
    usernameTaken: 'Benutzername ist schon vergeben',
    validation: 'Validierung fehlgeschlagen',
    sessionExpired: 'Sitzung abgelaufen',
    badCredentials: 'E-Mail oder Passwort falsch',
    cardNotFound: 'Karte nicht gefunden',
    deckNotFound: 'Deck nicht gefunden',
    metaDeckNotFound: 'Meta-Deck nicht gefunden',
    officialDeckNotFound: 'Offizielles Deck nicht gefunden',
    productNotFound: 'Produkt nicht gefunden',
    productNotOwned: 'Produkt nicht in deiner Sammlung gefunden',
    productEmpty: 'Dieses Produkt enthält keine bekannte Karte',
    printMismatch: 'Dieser Druck passt nicht zur Karte',
    invalidPrint: 'Ungültiger Druck',
    invalidDeck: 'Ungültiges Deck',
    ydkEmpty: 'Leere oder ungültige .ydk-Datei',
    ydkNoCards: 'Keine Karte in dieser .ydk erkannt',
    unknownCards: 'Unbekannte Karte(n) in der Deckliste',
    archetypeNotOwned: 'Keine „{archetype}“-Karte in deiner Sammlung',
    syncRunning: 'Es läuft bereits eine Synchronisierung',
    metaSyncRunning: 'Meta-Update läuft bereits',
    syncFailed: 'Synchronisierung fehlgeschlagen: {message}',
  },

  validation: {
    required: 'Pflichtfeld',
    invalid: 'Ungültiger Wert',
    minChars: 'Mindestens {min} Zeichen',
    maxChars: 'Maximal {max} Zeichen',
    min: 'Minimum {min}',
    max: 'Maximum {max}',
    email: 'Ungültige E-Mail-Adresse',
    pattern: 'Nur Buchstaben, Zahlen, _ und -',
    format: 'Ungültiges Format',
  },

  generator: {
    officialBasedOn: 'Offizielle Liste von „{name}“ (Yugipedia).',
    ownedName: '{name} (meine Sammlung)',
    autoName: '{name} (auto)',
    composition:
      'Zusammensetzung: {engine} Engine-Karten, {staples} Staples, {fillers} generische Füllkarten.',
    incomplete: {
      one: 'Mit deiner Sammlung fehlt {count} Karte bis 40: Wechsle zur vollständigen Liste, um zu sehen, was du kaufen musst.',
      other:
        'Mit deiner Sammlung fehlen {count} Karten bis 40: Wechsle zur vollständigen Liste, um zu sehen, was du kaufen musst.',
    },
    fragile:
      'Komplett, aber wackelig: zu viele generische Karten im Verhältnis zur Engine. Bau den Archetyp aus, damit das Deck wirklich spielbar wird.',
    basedOn: {
      one: 'Basiert auf {count} aktuellen Turnierliste.',
      other: 'Basiert auf {count} aktuellen Turnierlisten.',
    },
    metaVersion: 'Es gibt eine Turnierversion: „{name}“ bei den Meta-Decks.',
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
    graveyard: 'Friedhof',
    handTraps: 'Hand Traps',
    beatdown: 'Beatdown',
    midrange: 'Midrange',
  },

  roles: {
    STARTER: 'Starter',
    SEARCHER: 'Searcher',
    EXTENDER: 'Extender',
    HAND_TRAP: 'Hand Trap',
    INTERRUPTION: 'Unterbrechung',
    REMOVAL: 'Removal',
    DRAW: 'Ziehen',
    RECOVERY: 'Recovery',
    FUSION_ENABLER: 'Fusion',
    RITUAL_ENABLER: 'Ritual',
    BOSS: 'Boss',
  },

  guide: {
    summary: {
      style: '{styles}-Deck',
      styleArchetype: '{styles}-Deck rund um {archetype}.',
      styleOnly: '{styles}-Deck.',
      bosses: 'Ziel ist es, {bosses} aus dem Extra Deck aufs Spielfeld zu bringen.',
      noBoss: 'Es spielt hauptsächlich aus dem Main Deck (kaum nutzbares Extra Deck).',
      starters:
        'Mit {count} Startern hast du in {odds5} der Fälle einen auf der Starthand ({odds6} als Zweiter).',
      noStarter: 'Kein klarer Starter: Das Deck kann starten, ohne etwas machen zu können.',
      unreadable:
        'Die Effekte von {subject} konnten nicht automatisch analysiert werden (fehlende Texte oder noch nicht erkannte Formulierungen). Der Guide beschränkt sich aufs Wesentliche: Verlass dich auf die Kartentexte.',
      unreadableArchetype: 'diesen {archetype}-Karten',
      unreadableDeck: 'diesem Deck',
    },
    stats: {
      starters: {
        label: 'Starter',
        hint: 'Karten, die deine Züge allein starten. Starthand mit mindestens einem Starter: {odds}.',
      },
      extenders: {
        label: 'Extender',
        hint: 'Karten, die eine Combo verlängern (beschwören sich selbst, beleben wieder…): nützlich, wenn der Starter gestoppt wird.',
      },
      handTraps: {
        label: 'Hand Traps',
        hint: 'Unterbrechungen, die du während des Spielzugs des Gegners von der Hand spielen kannst.',
      },
      extra: {
        label: 'Beschwörbares Extra',
        hint: 'Extra-Deck-Monster, die du mit den Materialien des Main Decks tatsächlich beschwören kannst.',
      },
      linked: {
        label: 'Verknüpfte Karten',
        hint: 'Anteil des Main Decks, der eine andere Karte des Decks sucht oder beschwört bzw. von ihr gesucht oder beschworen wird.',
      },
      interactions: {
        label: 'Interaktionen',
        hint: 'Negierungen und Removal (ohne Hand Traps), um mit dem Board des Gegners fertigzuwerden.',
      },
    },
    plan: {
      starters:
        'Versuch, mit einem Starter zu eröffnen: {cards}. Sie suchen oder beschwören den Rest der Engine aus dem Deck.',
      chain: 'Wichtige Suchkette: {a} sucht {b}, das wiederum {c} sucht.',
      gyTrigger:
        '{card} bringt auf der Hand nichts: Der Effekt wird im Friedhof ausgelöst. Leg es auf den Friedhof mit {how}.',
      asMaterial: 'indem du es als Beschwörungsmaterial verwendest',
      endBoard: 'Ziel am Ende des Spielzugs: {boss} ({mechanic}).',
      endBoardWith:
        'Ziel am Ende des Spielzugs: {boss} ({mechanic}), zum Beispiel mit {materials}.',
      draw: 'Ziehkarten ({cards}) helfen dir, nach deinen Startern zu graben: Spiel sie früh im Spielzug.',
    },
    first: {
      combo:
        'Zieh deine Combo bis {bosses} durch und behalte etwas, um den Spielzug des Gegners zu unterbrechen.',
      negaters: {
        one: '{cards} kann negieren: Das ist deine eigentliche Mauer, bevorzuge die Lines, die dorthin führen.',
        other:
          '{cards} können negieren: Das ist deine eigentliche Mauer, bevorzuge die Lines, die dorthin führen.',
      },
      traps: {
        one: 'Setz deine Falle ({count} im Deck) am Ende des Spielzugs: Sie funktioniert erst, wenn sie gesetzt ist.',
        other:
          'Setz deine Fallen ({count} im Deck) am Ende des Spielzugs: Sie funktionieren erst, wenn sie gesetzt sind.',
      },
      handTrapCheck:
        'Überleg vor dem Start, welche gegnerische Karte (Hand Trap) deine Combo stoppen könnte, und beginne mit dem Effekt, dessen Verlust du am ehesten verkraftest.',
    },
    second: {
      handTraps:
        'Deine Hand Traps ({cards}) spielst du im Spielzug des Gegners: Heb sie für den Effekt auf, der seine Combo startet (Suche, Beschwörung aus dem Deck).',
      removal:
        'Um das Board des Gegners zu brechen: {cards}. Nimm zuerst das Monster ins Visier, das negiert.',
      noRemoval:
        'Dem Deck fehlen Karten, um ein Board zu brechen: Denk an generische „Board Breaker“ (Raigeki, Dark Ruler No More, Evenly Matched…).',
      extraDraw:
        'Du ziehst eine Karte mehr: Halte dich bei deiner Combo nicht zurück, der Gegner hat schon einen Teil seiner Ressourcen verbraucht.',
    },
    mistakes: {
      normalSummon:
        '{cards} brauchen alle deine Normalbeschwörung: Hast du zwei davon auf der Hand, nimm die, die zur besten Combo führt – die andere muss warten.',
      oncePerTurn:
        '{cards}: Effekt nur einmal pro Spielzug nutzbar. Zwei auf der Hand verdoppeln den Effekt nicht, heb das 2. Exemplar für den nächsten Spielzug auf.',
      freeFirst:
        'Spiel zuerst die Karten, die deine Normalbeschwörung nicht kosten (Zauber, Monster, die sich selbst beschwören), und entscheide dann, was du als Normalbeschwörung beschwörst.',
      gyTriggers:
        'Beschwöre {cards} nicht als Normalbeschwörung: Ihr Effekt funktioniert erst, wenn sie auf den Friedhof gelegt wurden.',
      handTrapTiming:
        'Feuere eine Hand Trap nicht auf die erste Karte des Gegners ab: Warte auf den Effekt, der wirklich zählt (oft die 2. oder 3. Aktivierung).',
      brick:
        '{card} ist schwer zu beschwören und nichts sucht es: Auf der Starthand ist es oft eine tote Karte. Spiel weniger davon oder streich es.',
      unreachable:
        '{card} kann mit den Materialien dieses Main Decks nicht beschworen werden: Es verschwendet einen Platz im Extra Deck.',
      fewStarters:
        'Wenige Starter: Wenn möglich, spiel {cards} auf 3 Exemplaren, um öfter eröffnen zu können.',
    },
    combo: {
      alone: '{card} allein',
    },
    explain: {
      SEARCH: 'sucht {cards}',
      SPECIAL_SUMMON: 'beschwört {cards}',
      SEND_GY: 'legt {cards} auf den Friedhof',
      RECOVER: 'holt {cards} zurück',
      accessible: 'erreichbar über {cards}',
      selfSummon: 'beschwört sich selbst',
      handTrap: 'wird im Spielzug des Gegners von der Hand gespielt',
      negates: 'kann eine Aktivierung annullieren',
      removal: 'zerstört oder entfernt eine Karte des Gegners',
      draws: 'zieht Karten',
      summonableWith: 'beschwörbar mit {cards}',
      extraOption: 'Extra-Deck-Option.',
      support: 'Support-Karte.',
    },
    steps: {
      NORMAL_SUMMON: 'Beschwöre {card} als Normalbeschwörung.',
      SPECIAL_SUMMON_SELF: 'Beschwöre {card} mit dem eigenen Effekt als Spezialbeschwörung.',
      ACTIVATE: 'Aktiviere {card}.',
      DISCARD: 'Wirf {card} ab, um den Effekt zu aktivieren.',
      SEARCH: '{card} fügt {target} deiner Hand hinzu.',
      SPECIAL_SUMMON: '{card} beschwört {target} als Spezialbeschwörung.',
      SEND_GY: '{card} legt {target} auf den Friedhof.',
      EXTRA_SUMMON: 'Beschwöre {card} per {mechanic}.',
      EXTRA_SUMMON_WITH: 'Beschwöre {card} per {mechanic} mit {materials}.',
      END_PHASE: 'In der End Phase holt {card} (im Friedhof) {target} aus dem Deck.',
    },
  },

  interactions: {
    noun: {
      tuner: 'Empfänger',
      nonTuner: 'Nicht-Empfänger',
      SPELL: 'Zauberkarte',
      TRAP: 'Fallenkarte',
      SPELL_TRAP: 'Zauber-/Fallenkarte',
      MONSTER: 'Monster',
      card: 'Karte',
    },
    attributes: {
      LIGHT: 'LICHT',
      DARK: 'FINSTERNIS',
      EARTH: 'ERDE',
      WATER: 'WASSER',
      FIRE: 'FEUER',
      WIND: 'WIND',
      DIVINE: 'GÖTTLICH',
    },
    /** Reihenfolge der Bausteine (leere werden entfernt): „LICHT Empfänger der Stufe 1“ */
    pattern: '{names} {attributes} {races} {subtypes} {noun} {level}',
    levelEq: 'der Stufe {level}',
    levelMin: 'der Stufe {level} oder höher',
    levelMax: 'der Stufe {level} oder niedriger',
    or: 'oder',
    except: '(außer {names})',
  },

  ai: {
    language: 'German (informal “du”, casual but precise)',
    errors: {
      unusable: 'Das Modell hat eine unbrauchbare Antwort geliefert ({path}: {message}).',
      empty: 'Das Modell hat eine leere Antwort geliefert.',
      timeout:
        'keine Antwort innerhalb von {seconds} s (erhöhe AI_TIMEOUT_MS für ein langsames lokales Modell)',
      unreachable: 'Server nicht erreichbar ({url}) – läuft der Modell-Server?',
      unavailable: 'KI nicht verfügbar: {message}',
    },
  },
};
