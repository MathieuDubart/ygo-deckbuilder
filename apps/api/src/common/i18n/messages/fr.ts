import type { DeepPartialMessages } from './types';

export const fr: DeepPartialMessages = {
  format: { quote: '« {text} »' },

  duel: {
    errors: {
      disabled: 'Le simulateur de duel est désactivé sur ce serveur.',
      notReady: 'Le simulateur télécharge les scripts des cartes, réessaie dans une minute.',
      engine: 'Le moteur de duel s’est arrêté de façon inattendue.',
      invalidResponse: 'Ce choix n’est pas possible maintenant.',
      notFound: 'Duel introuvable ou expiré.',
      emptyDeck: 'Ce deck n’a aucune carte de Main Deck connue du simulateur.',
    },
  },

  errors: {
    emailTaken: 'Email déjà utilisé',
    usernameTaken: "Nom d'utilisateur déjà pris",
    validation: 'Validation échouée',
    sessionExpired: 'Session expirée',
    badCredentials: 'Email ou mot de passe incorrect',
    cardNotFound: 'Carte introuvable',
    deckNotFound: 'Deck introuvable',
    metaDeckNotFound: 'Deck meta introuvable',
    officialDeckNotFound: 'Deck officiel introuvable',
    productNotFound: 'Produit introuvable',
    productNotOwned: 'Produit introuvable dans ta collection',
    productEmpty: 'Ce produit ne contient aucune carte connue',
    printMismatch: 'Cette édition ne correspond pas à la carte',
    invalidPrint: 'Édition invalide',
    invalidDeck: 'Deck invalide',
    ydkEmpty: 'Fichier .ydk vide ou invalide',
    ydkNoCards: 'Aucune carte reconnue dans ce .ydk',
    unknownCards: 'Carte(s) inconnue(s) dans la decklist',
    archetypeNotOwned: 'Aucune carte « {archetype} » dans ta collection',
    syncRunning: 'Une synchronisation est déjà en cours',
    metaSyncRunning: 'Mise à jour du meta déjà en cours',
    syncFailed: 'Synchronisation échouée : {message}',
  },

  validation: {
    required: 'Obligatoire',
    invalid: 'Valeur invalide',
    minChars: '{min} caractères minimum',
    maxChars: '{max} caractères maximum',
    min: 'Minimum {min}',
    max: 'Maximum {max}',
    email: 'Adresse email invalide',
    pattern: 'Lettres, chiffres, _ et - uniquement',
    format: 'Format invalide',
  },

  generator: {
    officialBasedOn: 'Liste officielle de « {name} » (Yugipedia).',
    ownedName: '{name} (ma collection)',
    autoName: '{name} (auto)',
    composition:
      'Composition : {engine} cartes moteur, {staples} staples, {fillers} compléments génériques.',
    incomplete: {
      one: 'Il manque {count} carte pour atteindre 40 avec ta collection : bascule sur la liste complète pour voir quoi acheter.',
      other:
        'Il manque {count} cartes pour atteindre 40 avec ta collection : bascule sur la liste complète pour voir quoi acheter.',
    },
    fragile:
      'Deck complet mais fragile : trop de cartes génériques par rapport au moteur. Renforce l’archétype pour le rendre vraiment jouable.',
    basedOn: {
      one: 'Basé sur {count} liste de tournoi récente.',
      other: 'Basé sur {count} listes de tournoi récentes.',
    },
    metaVersion: 'Une version tournoi existe : « {name} » dans les decks meta.',
  },

  mechanics: { FUSION: 'Fusion', SYNCHRO: 'Synchro', XYZ: 'Xyz', LINK: 'Lien', RITUAL: 'Rituelle' },

  styles: {
    ritual: 'Rituel',
    combo: 'Combo',
    control: 'Contrôle',
    graveyard: 'Cimetière',
    handTraps: 'Hand traps',
    beatdown: 'Beatdown',
    midrange: 'Midrange',
  },

  roles: {
    STARTER: 'Starter',
    SEARCHER: 'Chercheur',
    EXTENDER: 'Extender',
    HAND_TRAP: 'Hand trap',
    INTERRUPTION: 'Interruption',
    REMOVAL: 'Destruction',
    DRAW: 'Pioche',
    RECOVERY: 'Récupération',
    FUSION_ENABLER: 'Fusion',
    RITUAL_ENABLER: 'Rituel',
    BOSS: 'Boss',
  },

  guide: {
    summary: {
      style: 'Deck {styles}',
      styleArchetype: 'Deck {styles} construit autour des {archetype}.',
      styleOnly: 'Deck {styles}.',
      bosses: 'Il cherche à poser {bosses} depuis l’Extra Deck.',
      noBoss: 'Il joue surtout avec son Main Deck (peu d’Extra Deck exploitable).',
      starters:
        'Avec {count} starters, tu en as un dans ta main de départ {odds5} du temps ({odds6} en jouant second).',
      noStarter: 'Aucun starter clair : le deck risque d’ouvrir sans rien pouvoir lancer.',
      unreadable:
        'Les effets de {subject} n’ont pas pu être analysés automatiquement (textes manquants ou tournures pas encore reconnues). Le guide se limite aux bases : fie-toi au texte des cartes.',
      unreadableArchetype: 'ces {archetype}',
      unreadableDeck: 'ce deck',
    },
    stats: {
      starters: {
        label: 'Starters',
        hint: 'Cartes qui lancent le jeu seules. Main de départ avec au moins un starter : {odds}.',
      },
      extenders: {
        label: 'Extenders',
        hint: 'Cartes qui prolongent un combo (s’invoquent seules, ressuscitent…) : utiles si le starter est stoppé.',
      },
      handTraps: {
        label: 'Hand traps',
        hint: 'Interruptions jouables depuis la main pendant le tour adverse.',
      },
      extra: {
        label: 'Extra invocable',
        hint: 'Monstres d’Extra Deck qu’on peut réellement invoquer avec les matériaux du Main Deck.',
      },
      linked: {
        label: 'Cartes liées',
        hint: 'Part du Main Deck qui cherche, invoque ou est cherchée/invoquée par une autre carte du deck.',
      },
      interactions: {
        label: 'Interactions',
        hint: 'Négations et destructions (hors hand traps) pour gérer le terrain adverse.',
      },
    },
    plan: {
      starters:
        'Cherche à ouvrir avec un starter : {cards}. Ce sont eux qui vont chercher ou invoquer le reste du moteur depuis le Deck.',
      chain: 'Chaîne de recherche clé : {a} va chercher {b}, qui va lui-même chercher {c}.',
      gyTrigger:
        '{card} ne fait rien en main : son effet se déclenche au cimetière. Envoie-le avec {how}.',
      asMaterial: 'en l’utilisant comme matériau d’Invocation',
      endBoard: 'Objectif de fin de tour : {boss} ({mechanic}).',
      endBoardWith: 'Objectif de fin de tour : {boss} ({mechanic}), avec par exemple {materials}.',
      draw: 'Les cartes de pioche ({cards}) servent à creuser vers tes starters : joue-les tôt dans le tour.',
    },
    first: {
      combo: 'Déroule ton combo jusqu’à {bosses} et garde de quoi interrompre le tour adverse.',
      negaters: {
        one: '{cards} peut nier : c’est ton vrai « mur », privilégie les lignes qui y mènent.',
        other: '{cards} peuvent nier : c’est ton vrai « mur », privilégie les lignes qui y mènent.',
      },
      traps: {
        one: 'Pose ton piège ({count} dans le deck) en fin de tour : il ne sert qu’une fois posé.',
        other:
          'Pose tes pièges ({count} dans le deck) en fin de tour : ils ne servent qu’une fois posés.',
      },
      handTrapCheck:
        'Avant de commencer, repère quelle carte adverse (hand trap) pourrait couper ton combo et commence par l’effet le moins grave à perdre.',
    },
    second: {
      handTraps:
        'Tes hand traps ({cards}) se jouent pendant le tour adverse : garde-les pour l’effet qui lance leur combo (recherche, invocation depuis le Deck).',
      removal: 'Pour casser le terrain adverse : {cards}. Vise d’abord le monstre qui nie.',
      noRemoval:
        'Le deck manque de cartes pour casser un terrain adverse : pense à des « board breakers » génériques (Raigeki, Dark Ruler No More, Evenly Matched…).',
      extraDraw:
        'Tu pioches une carte de plus : n’hésite pas à jouer à fond ton combo, l’adversaire a déjà utilisé une partie de ses ressources.',
    },
    mistakes: {
      normalSummon:
        '{cards} demandent toutes ton Invocation Normale : avec deux d’entre elles en main, choisis celle qui mène au meilleur combo, l’autre attendra.',
      oncePerTurn:
        '{cards} : effet utilisable 1 fois par tour. En avoir deux en main ne double pas l’effet, garde le 2e exemplaire pour le tour suivant.',
      freeFirst:
        'Joue d’abord les cartes qui ne coûtent pas ton Invocation Normale (magies, monstres qui s’invoquent seuls), puis décide quoi Invoquer Normalement.',
      gyTriggers:
        'N’Invoque pas Normalement {cards} : leur effet ne marche qu’une fois envoyés au cimetière.',
      handTrapTiming:
        'Ne lâche pas une hand trap sur la première carte adverse : attends l’effet qui compte vraiment (souvent la 2e ou 3e activation).',
      brick:
        '{card} est difficile à invoquer et rien ne va la chercher : en main de départ, c’est souvent une carte morte. Envisage de la réduire ou de la retirer.',
      unreachable:
        '{card} ne peut pas être invoqué avec les matériaux de ce Main Deck : il prend une place inutile dans l’Extra Deck.',
      fewStarters:
        'Peu de starters : si tu peux, monte {cards} à 3 exemplaires pour ouvrir plus souvent.',
    },
    combo: { alone: '{card} seul' },
    explain: {
      SEARCH: 'cherche {cards}',
      SPECIAL_SUMMON: 'invoque {cards}',
      SEND_GY: 'envoie au cimetière {cards}',
      RECOVER: 'récupère {cards}',
      accessible: 'accessible via {cards}',
      selfSummon: 's’invoque toute seule',
      handTrap: 'se joue depuis la main pendant le tour adverse',
      negates: 'peut nier une activation',
      removal: 'détruit ou retire une carte adverse',
      draws: 'fait piocher',
      summonableWith: 'invocable avec {cards}',
      extraOption: 'Option d’Extra Deck.',
      support: 'Carte de soutien.',
    },
    steps: {
      NORMAL_SUMMON: 'Invocation Normale de {card}.',
      SPECIAL_SUMMON_SELF: 'Invoque Spécialement {card} avec son propre effet.',
      ACTIVATE: 'Active {card}.',
      DISCARD: 'Défausse {card} pour activer son effet.',
      SEARCH: '{card} ajoute {target} à ta main.',
      SPECIAL_SUMMON: '{card} Invoque Spécialement {target}.',
      SEND_GY: '{card} envoie {target} au cimetière.',
      EXTRA_SUMMON: 'Invocation {mechanic} de {card}.',
      EXTRA_SUMMON_WITH: 'Invocation {mechanic} de {card} avec {materials}.',
      END_PHASE: 'En End Phase, {card} (au cimetière) fait venir {target} depuis le Deck.',
    },
  },

  interactions: {
    noun: {
      tuner: 'Syntoniseur',
      nonTuner: 'non-Syntoniseur',
      SPELL: 'Magie',
      TRAP: 'Piège',
      SPELL_TRAP: 'Magie/Piège',
      MONSTER: 'monstre',
      card: 'carte',
    },
    attributes: {
      LIGHT: 'LUMIÈRE',
      DARK: 'TÉNÈBRES',
      EARTH: 'TERRE',
      WATER: 'EAU',
      FIRE: 'FEU',
      WIND: 'VENT',
      DIVINE: 'DIVIN',
    },
    pattern: '{noun} {subtypes} {races} {attributes} {level} {names}',
    levelEq: 'de niveau {level}',
    levelMin: 'de niveau {level} ou plus',
    levelMax: 'de niveau {level} ou moins',
    or: 'ou',
    except: '(sauf {names})',
  },

  ai: {
    language: 'French (tutoiement, casual but precise)',
    errors: {
      unusable: 'Le modèle a donné une réponse inexploitable ({path} : {message}).',
      empty: 'Le modèle a donné une réponse vide.',
      timeout: 'pas de réponse en {seconds} s (augmente AI_TIMEOUT_MS pour un modèle local lent)',
      unreachable: 'serveur injoignable ({url}) — le serveur du modèle est-il lancé ?',
      unavailable: 'IA indisponible : {message}',
    },
  },
};
