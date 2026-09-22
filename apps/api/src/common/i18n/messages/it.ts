import type { DeepPartialMessages } from './types';

export const it: DeepPartialMessages = {
  format: { quote: '«{text}»' },

  duel: {
    errors: {
      disabled: 'Il simulatore di duelli è disattivato su questo server.',
      notReady: 'Il simulatore sta scaricando gli script delle carte, riprova tra un minuto.',
      engine: 'Il motore del duello si è arrestato in modo imprevisto.',
      invalidResponse: 'Questa scelta non è possibile adesso.',
      notFound: 'Duello non trovato o scaduto.',
      emptyDeck: 'Questo deck non ha carte del Main Deck note al simulatore.',
    },
  },

  errors: {
    emailTaken: 'Email già in uso',
    usernameTaken: 'Nome utente già preso',
    validation: 'Validazione fallita',
    sessionExpired: 'Sessione scaduta',
    badCredentials: 'Email o password errati',
    cardNotFound: 'Carta non trovata',
    deckNotFound: 'Deck non trovato',
    metaDeckNotFound: 'Deck meta non trovato',
    officialDeckNotFound: 'Deck ufficiale non trovato',
    productNotFound: 'Prodotto non trovato',
    productNotOwned: 'Prodotto non trovato nella tua collezione',
    productEmpty: 'Questo prodotto non contiene nessuna carta conosciuta',
    printMismatch: 'Questa stampa non corrisponde alla carta',
    invalidPrint: 'Stampa non valida',
    invalidDeck: 'Deck non valido',
    ydkEmpty: 'File .ydk vuoto o non valido',
    ydkNoCards: 'Nessuna carta riconosciuta in questo .ydk',
    unknownCards: 'Carta/e sconosciuta/e nella decklist',
    archetypeNotOwned: 'Nessuna carta «{archetype}» nella tua collezione',
    syncRunning: 'Una sincronizzazione è già in corso',
    metaSyncRunning: 'Aggiornamento del meta già in corso',
    syncFailed: 'Sincronizzazione fallita: {message}',
  },

  validation: {
    required: 'Obbligatorio',
    invalid: 'Valore non valido',
    minChars: 'Almeno {min} caratteri',
    maxChars: 'Massimo {max} caratteri',
    min: 'Minimo {min}',
    max: 'Massimo {max}',
    email: 'Indirizzo email non valido',
    pattern: 'Solo lettere, numeri, _ e -',
    format: 'Formato non valido',
  },

  generator: {
    officialBasedOn: 'Lista ufficiale di «{name}» (Yugipedia).',
    ownedName: '{name} (la mia collezione)',
    autoName: '{name} (auto)',
    composition:
      'Composizione: {engine} carte dell’engine, {staples} staple, {fillers} riempitivi generici.',
    incomplete: {
      one: 'Manca {count} carta per arrivare a 40 con la tua collezione: passa alla lista completa per vedere cosa comprare.',
      other:
        'Mancano {count} carte per arrivare a 40 con la tua collezione: passa alla lista completa per vedere cosa comprare.',
    },
    fragile:
      'Completo ma fragile: troppe carte generiche rispetto all’engine. Rinforza l’archetipo per renderlo davvero giocabile.',
    basedOn: {
      one: 'Basato su {count} lista da torneo recente.',
      other: 'Basato su {count} liste da torneo recenti.',
    },
    metaVersion: 'Esiste una versione da torneo: «{name}» tra i deck meta.',
  },

  mechanics: {
    FUSION: 'Fusione',
    SYNCHRO: 'Synchro',
    XYZ: 'Xyz',
    LINK: 'Link',
    RITUAL: 'Rituale',
  },

  styles: {
    ritual: 'Rituale',
    combo: 'Combo',
    control: 'Controllo',
    graveyard: 'Cimitero',
    handTraps: 'Hand trap',
    beatdown: 'Beatdown',
    midrange: 'Midrange',
  },

  roles: {
    STARTER: 'Starter',
    SEARCHER: 'Searcher',
    EXTENDER: 'Extender',
    HAND_TRAP: 'Hand trap',
    INTERRUPTION: 'Interruzione',
    REMOVAL: 'Rimozione',
    DRAW: 'Pesca',
    RECOVERY: 'Recupero',
    FUSION_ENABLER: 'Fusione',
    RITUAL_ENABLER: 'Rituale',
    BOSS: 'Boss',
  },

  guide: {
    summary: {
      style: 'Deck {styles}',
      styleArchetype: 'Deck {styles} costruito attorno a {archetype}.',
      styleOnly: 'Deck {styles}.',
      bosses: 'Punta a mettere sul Terreno {bosses} dall’Extra Deck.',
      noBoss: 'Gioca soprattutto con il Main Deck (poco Extra Deck utilizzabile).',
      starters:
        'Con {count} starter, ne peschi uno nella mano iniziale il {odds5} delle volte ({odds6} giocando per secondo).',
      noStarter: 'Nessuno starter chiaro: il deck rischia di aprire senza poter fare niente.',
      unreadable:
        'Non è stato possibile analizzare automaticamente gli effetti di {subject} (testi mancanti o formulazioni non ancora riconosciute). La guida si limita alle basi: fai riferimento al testo delle carte.',
      unreadableArchetype: 'queste carte {archetype}',
      unreadableDeck: 'questo deck',
    },
    stats: {
      starters: {
        label: 'Starter',
        hint: 'Carte che avviano le tue giocate da sole. Mano iniziale con almeno uno starter: {odds}.',
      },
      extenders: {
        label: 'Extender',
        hint: 'Carte che allungano una combo (si evocano da sole, rianimano…): utili quando lo starter viene fermato.',
      },
      handTraps: {
        label: 'Hand trap',
        hint: 'Interruzioni che puoi giocare dalla mano durante il turno dell’avversario.',
      },
      extra: {
        label: 'Extra evocabile',
        hint: 'Mostri dell’Extra Deck che puoi davvero evocare con i materiali del Main Deck.',
      },
      linked: {
        label: 'Carte collegate',
        hint: 'Quota del Main Deck che cerca, evoca o viene cercata/evocata da un’altra carta del deck.',
      },
      interactions: {
        label: 'Interazioni',
        hint: 'Negazioni e rimozioni (hand trap escluse) per gestire il Terreno dell’avversario.',
      },
    },
    plan: {
      starters:
        'Cerca di aprire con uno starter: {cards}. Sono loro a cercare o evocare il resto dell’engine dal Deck.',
      chain: 'Catena di ricerca chiave: {a} cerca {b}, che a sua volta cerca {c}.',
      gyTrigger:
        '{card} non fa niente in mano: il suo effetto si attiva nel Cimitero. Mandacelo con {how}.',
      asMaterial: 'usandolo come materiale per un’Evocazione',
      endBoard: 'Obiettivo di fine turno: {boss} ({mechanic}).',
      endBoardWith: 'Obiettivo di fine turno: {boss} ({mechanic}), per esempio con {materials}.',
      draw: 'Le carte che fanno pescare ({cards}) ti aiutano a trovare gli starter: giocale all’inizio del turno.',
    },
    first: {
      combo:
        'Porta a termine la combo fino a {bosses} e tieni qualcosa per interrompere il turno dell’avversario.',
      negaters: {
        one: '{cards} può negare: è il tuo vero muro, preferisci le linee che ci portano.',
        other: '{cards} possono negare: sono il tuo vero muro, preferisci le linee che ci portano.',
      },
      traps: {
        one: 'Posiziona la tua Trappola ({count} nel deck) a fine turno: funziona solo dopo essere stata posizionata.',
        other:
          'Posiziona le tue Trappole ({count} nel deck) a fine turno: funzionano solo dopo essere state posizionate.',
      },
      handTrapCheck:
        'Prima di iniziare, individua quale carta avversaria (hand trap) potrebbe fermare la combo e comincia con l’effetto che puoi permetterti di perdere.',
    },
    second: {
      handTraps:
        'Le tue hand trap ({cards}) si giocano durante il turno dell’avversario: tienile per l’effetto che avvia la sua combo (ricerca, Evocazione dal Deck).',
      removal: 'Per rompere il Terreno dell’avversario: {cards}. Punta prima il mostro che nega.',
      noRemoval:
        'Al deck mancano carte per rompere un Terreno: valuta dei «board breaker» generici (Raigeki, Dark Ruler No More, Evenly Matched…).',
      extraDraw:
        'Peschi una carta in più: non risparmiarti con la combo, l’avversario ha già usato parte delle sue risorse.',
    },
    mistakes: {
      normalSummon:
        '{cards} richiedono tutte la tua Evocazione Normale: se ne hai due in mano, scegli quella che porta alla combo migliore, l’altra aspetterà.',
      oncePerTurn:
        '{cards}: effetto utilizzabile una volta per turno. Averne due in mano non raddoppia l’effetto, tieni la 2ª copia per il turno dopo.',
      freeFirst:
        'Gioca prima le carte che non consumano la tua Evocazione Normale (Magie, mostri che si evocano da soli), poi decidi cosa Evocare Normalmente.',
      gyTriggers:
        'Non Evocare Normalmente {cards}: il loro effetto funziona solo una volta mandati al Cimitero.',
      handTrapTiming:
        'Non sparare una hand trap sulla prima carta dell’avversario: aspetta l’effetto che conta davvero (spesso la 2ª o 3ª attivazione).',
      brick:
        '{card} è difficile da evocare e niente la cerca: in mano iniziale è spesso una carta morta. Valuta di giocarne meno copie o di toglierla.',
      unreachable:
        '{card} non può essere evocato con i materiali di questo Main Deck: spreca uno slot nell’Extra Deck.',
      fewStarters: 'Pochi starter: se puoi, porta {cards} a 3 copie per aprire bene più spesso.',
    },
    combo: {
      alone: '{card} da solo',
    },
    explain: {
      SEARCH: 'cerca {cards}',
      SPECIAL_SUMMON: 'evoca {cards}',
      SEND_GY: 'manda {cards} al Cimitero',
      RECOVER: 'recupera {cards}',
      accessible: 'raggiungibile tramite {cards}',
      selfSummon: 'si evoca da sola',
      handTrap: 'si gioca dalla mano durante il turno dell’avversario',
      negates: 'può negare un’attivazione',
      removal: 'distrugge o rimuove una carta dell’avversario',
      draws: 'fa pescare',
      summonableWith: 'evocabile con {cards}',
      extraOption: 'Opzione dell’Extra Deck.',
      support: 'Carta di supporto.',
    },
    steps: {
      NORMAL_SUMMON: 'Evoca Normalmente {card}.',
      SPECIAL_SUMMON_SELF: 'Evoca Specialmente {card} con il suo stesso effetto.',
      ACTIVATE: 'Attiva {card}.',
      DISCARD: 'Scarta {card} per attivarne l’effetto.',
      SEARCH: '{card} aggiunge {target} alla tua mano.',
      SPECIAL_SUMMON: '{card} Evoca Specialmente {target}.',
      SEND_GY: '{card} manda {target} al Cimitero.',
      EXTRA_SUMMON: 'Evocazione {mechanic} di {card}.',
      EXTRA_SUMMON_WITH: 'Evocazione {mechanic} di {card} usando {materials}.',
      END_PHASE: 'Durante la End Phase, {card} (nel Cimitero) porta {target} dal Deck.',
    },
  },

  interactions: {
    noun: {
      tuner: 'Tuner',
      nonTuner: 'non-Tuner',
      SPELL: 'Magia',
      TRAP: 'Trappola',
      SPELL_TRAP: 'Magia/Trappola',
      MONSTER: 'mostro',
      card: 'carta',
    },
    attributes: {
      LIGHT: 'LUCE',
      DARK: 'OSCURITÀ',
      EARTH: 'TERRA',
      WATER: 'ACQUA',
      FIRE: 'FUOCO',
      WIND: 'VENTO',
      DIVINE: 'DIVINO',
    },
    pattern: '{noun} {subtypes} {races} {attributes} {level} {names}',
    levelEq: 'di Livello {level}',
    levelMin: 'di Livello {level} o superiore',
    levelMax: 'di Livello {level} o inferiore',
    or: 'o',
    except: '(tranne {names})',
  },

  ai: {
    language: 'Italian (informal “tu”, casual but precise)',
    errors: {
      unusable: 'Il modello ha dato una risposta inutilizzabile ({path}: {message}).',
      empty: 'Il modello ha dato una risposta vuota.',
      timeout:
        'nessuna risposta entro {seconds} s (aumenta AI_TIMEOUT_MS per un modello locale lento)',
      unreachable: 'server irraggiungibile ({url}) — il server del modello è avviato?',
      unavailable: 'IA non disponibile: {message}',
    },
  },
};
