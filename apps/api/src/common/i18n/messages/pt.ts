import type { DeepPartialMessages } from './types';

/** Português (Brasil) — terminologia oficial do TCG brasileiro, tratamento “você”. */
export const pt: DeepPartialMessages = {
  format: { quote: '“{text}”' },

  errors: {
    emailTaken: 'E-mail já em uso',
    usernameTaken: 'Nome de usuário já em uso',
    validation: 'Falha na validação',
    sessionExpired: 'Sessão expirada',
    badCredentials: 'E-mail ou senha incorretos',
    cardNotFound: 'Card não encontrado',
    deckNotFound: 'Deck não encontrado',
    metaDeckNotFound: 'Deck do meta não encontrado',
    officialDeckNotFound: 'Deck oficial não encontrado',
    productNotFound: 'Produto não encontrado',
    productNotOwned: 'Produto não encontrado na sua coleção',
    productEmpty: 'Este produto não contém nenhum card conhecido',
    printMismatch: 'Esta impressão não corresponde ao card',
    invalidPrint: 'Impressão inválida',
    invalidDeck: 'Deck inválido',
    ydkEmpty: 'Arquivo .ydk vazio ou inválido',
    ydkNoCards: 'Nenhum card reconhecido neste .ydk',
    unknownCards: 'Card(s) desconhecido(s) na lista do deck',
    archetypeNotOwned: 'Nenhum card “{archetype}” na sua coleção',
    syncRunning: 'Já existe uma sincronização em andamento',
    metaSyncRunning: 'A atualização do meta já está em andamento',
    syncFailed: 'Falha na sincronização: {message}',
  },

  validation: {
    required: 'Obrigatório',
    invalid: 'Valor inválido',
    minChars: 'Pelo menos {min} caracteres',
    maxChars: 'No máximo {max} caracteres',
    min: 'Mínimo {min}',
    max: 'Máximo {max}',
    email: 'E-mail inválido',
    pattern: 'Apenas letras, números, _ e -',
    format: 'Formato inválido',
  },

  generator: {
    officialBasedOn: 'Lista oficial de “{name}” (Yugipedia).',
    ownedName: '{name} (minha coleção)',
    autoName: '{name} (auto)',
    composition:
      'Composição: {engine} cards da engine, {staples} staples, {fillers} cards genéricos de preenchimento.',
    incomplete: {
      one: 'Falta {count} card para chegar a 40 com a sua coleção: mude para a lista completa para ver o que comprar.',
      other:
        'Faltam {count} cards para chegar a 40 com a sua coleção: mude para a lista completa para ver o que comprar.',
    },
    fragile:
      'Completo, mas frágil: muitos cards genéricos em relação à engine. Reforce o arquétipo para deixá-lo realmente jogável.',
    basedOn: {
      one: 'Baseado em {count} lista de torneio recente.',
      other: 'Baseado em {count} listas de torneio recentes.',
    },
    metaVersion: 'Existe uma versão de torneio: “{name}” nos decks do meta.',
  },

  mechanics: {
    FUSION: 'Fusão',
    SYNCHRO: 'Sincro',
    XYZ: 'Xyz',
    LINK: 'Link',
    RITUAL: 'Ritual',
  },

  styles: {
    ritual: 'Ritual',
    combo: 'Combo',
    control: 'Controle',
    graveyard: 'Cemitério',
    handTraps: 'Hand traps',
    beatdown: 'Beatdown',
    midrange: 'Midrange',
  },

  roles: {
    STARTER: 'Starter',
    SEARCHER: 'Buscador',
    EXTENDER: 'Extender',
    HAND_TRAP: 'Hand trap',
    INTERRUPTION: 'Interrupção',
    REMOVAL: 'Remoção',
    DRAW: 'Compra',
    RECOVERY: 'Recuperação',
    FUSION_ENABLER: 'Fusão',
    RITUAL_ENABLER: 'Ritual',
    BOSS: 'Boss',
  },

  guide: {
    summary: {
      style: 'Deck {styles}',
      styleArchetype: 'Deck {styles} construído em torno de {archetype}.',
      styleOnly: 'Deck {styles}.',
      bosses: 'O objetivo é colocar {bosses} no campo a partir do Deck Adicional.',
      noBoss: 'Ele joga principalmente com o Deck Principal (pouco Deck Adicional utilizável).',
      starters:
        'Com {count} starters, você abre com um deles em {odds5} das vezes ({odds6} jogando segundo).',
      noStarter: 'Nenhum starter claro: o deck pode abrir sem conseguir fazer nada.',
      unreadable:
        'Os efeitos de {subject} não puderam ser analisados automaticamente (textos ausentes ou redação ainda não reconhecida). O guia fica no básico: confie nos textos dos cards.',
      unreadableArchetype: 'estes cards {archetype}',
      unreadableDeck: 'este deck',
    },
    stats: {
      starters: {
        label: 'Starters',
        hint: 'Cards que começam suas jogadas sozinhos. Mão inicial com pelo menos um starter: {odds}.',
      },
      extenders: {
        label: 'Extenders',
        hint: 'Cards que estendem um combo (se invocam sozinhos, revivem…): úteis quando o starter é parado.',
      },
      handTraps: {
        label: 'Hand traps',
        hint: 'Interrupções que você joga da mão durante o turno do oponente.',
      },
      extra: {
        label: 'Adicional invocável',
        hint: 'Monstros do Deck Adicional que você consegue invocar de verdade com as matérias do Deck Principal.',
      },
      linked: {
        label: 'Cards conectados',
        hint: 'Parte do Deck Principal que busca, invoca ou é buscada/invocada por outro card do deck.',
      },
      interactions: {
        label: 'Interações',
        hint: 'Negações e remoções (sem contar hand traps) para lidar com o campo do oponente.',
      },
    },
    plan: {
      starters:
        'Tente abrir com um starter: {cards}. São eles que buscam ou invocam o resto da engine a partir do Deck.',
      chain: 'Cadeia de busca principal: {a} busca {b}, que por sua vez busca {c}.',
      gyTrigger: '{card} não faz nada na mão: o efeito dele ativa no Cemitério. Envie-o com {how}.',
      asMaterial: 'usando-o como matéria de Invocação',
      endBoard: 'Objetivo de fim de turno: {boss} ({mechanic}).',
      endBoardWith: 'Objetivo de fim de turno: {boss} ({mechanic}), por exemplo com {materials}.',
      draw: 'Os cards de compra ({cards}) ajudam a cavar seus starters: jogue-os no começo do turno.',
    },
    first: {
      combo: 'Faça seu combo até {bosses} e guarde algo para interromper o turno do oponente.',
      negaters: {
        one: '{cards} pode negar: essa é a sua verdadeira muralha, priorize as linhas que levam até ele.',
        other:
          '{cards} podem negar: essa é a sua verdadeira muralha, priorize as linhas que levam até eles.',
      },
      traps: {
        one: 'Baixe sua Armadilha ({count} no deck) no fim do turno: ela só funciona depois de baixada.',
        other:
          'Baixe suas Armadilhas ({count} no deck) no fim do turno: elas só funcionam depois de baixadas.',
      },
      handTrapCheck:
        'Antes de começar, identifique qual card do oponente (hand trap) pode cortar seu combo e comece pelo efeito que você pode perder com menos prejuízo.',
    },
    second: {
      handTraps:
        'Suas hand traps ({cards}) são jogadas durante o turno do oponente: guarde-as para o efeito que inicia o combo dele (busca, invocação a partir do Deck).',
      removal: 'Para quebrar o campo do oponente: {cards}. Mire primeiro no monstro que nega.',
      noRemoval:
        'O deck não tem cards para quebrar um campo: considere “board breakers” genéricos (Raigeki, Dark Ruler No More, Evenly Matched…).',
      extraDraw:
        'Você compra um card a mais: não se segure no combo, o oponente já gastou parte dos recursos dele.',
    },
    mistakes: {
      normalSummon:
        '{cards} precisam da sua Invocação-Normal: com dois deles na mão, escolha o que leva ao melhor combo, o outro espera.',
      oncePerTurn:
        '{cards}: efeito utilizável uma vez por turno. Ter dois na mão não dobra o efeito, guarde a 2ª cópia para o próximo turno.',
      freeFirst:
        'Jogue primeiro os cards que não gastam sua Invocação-Normal (Magias, monstros que se invocam sozinhos), depois decida o que Invocar por Invocação-Normal.',
      gyTriggers:
        'Não Invoque {cards} por Invocação-Normal: o efeito deles só funciona depois de enviados para o Cemitério.',
      handTrapTiming:
        'Não use uma hand trap no primeiro card do oponente: espere o efeito que realmente importa (muitas vezes a 2ª ou 3ª ativação).',
      brick:
        '{card} é difícil de invocar e nada o busca: na mão inicial, costuma ser um card morto. Considere jogar menos cópias ou tirá-lo.',
      unreachable:
        '{card} não pode ser invocado com as matérias deste Deck Principal: ele desperdiça um espaço no Deck Adicional.',
      fewStarters:
        'Poucos starters: se puder, suba {cards} para 3 cópias para abrir com eles mais vezes.',
    },
    combo: {
      alone: '{card} sozinho',
    },
    explain: {
      SEARCH: 'busca {cards}',
      SPECIAL_SUMMON: 'invoca {cards}',
      SEND_GY: 'envia {cards} para o Cemitério',
      RECOVER: 'recupera {cards}',
      accessible: 'acessível através de {cards}',
      selfSummon: 'se invoca sozinho',
      handTrap: 'é jogado da mão durante o turno do oponente',
      negates: 'pode negar uma ativação',
      removal: 'destrói ou remove um card do oponente',
      draws: 'compra cards',
      summonableWith: 'invocável com {cards}',
      extraOption: 'Opção de Deck Adicional.',
      support: 'Card de suporte.',
    },
    steps: {
      NORMAL_SUMMON: 'Invoque {card} por Invocação-Normal.',
      SPECIAL_SUMMON_SELF: 'Invoque {card} por Invocação-Especial com o próprio efeito dele.',
      ACTIVATE: 'Ative {card}.',
      DISCARD: 'Descarte {card} para ativar o efeito dele.',
      SEARCH: '{card} adiciona {target} à sua mão.',
      SPECIAL_SUMMON: '{card} Invoca {target} por Invocação-Especial.',
      SEND_GY: '{card} envia {target} para o Cemitério.',
      EXTRA_SUMMON: 'Invoque {card} por Invocação-{mechanic}.',
      EXTRA_SUMMON_WITH: 'Invoque {card} por Invocação-{mechanic} usando {materials}.',
      END_PHASE: 'Durante a Fase Final, {card} (no Cemitério) traz {target} do Deck.',
    },
  },

  interactions: {
    noun: {
      tuner: 'Regulador',
      nonTuner: 'não-Regulador',
      SPELL: 'Magia',
      TRAP: 'Armadilha',
      SPELL_TRAP: 'Magia/Armadilha',
      MONSTER: 'monstro',
      card: 'card',
    },
    attributes: {
      LIGHT: 'LUZ',
      DARK: 'TREVAS',
      EARTH: 'TERRA',
      WATER: 'ÁGUA',
      FIRE: 'FOGO',
      WIND: 'VENTO',
      DIVINE: 'DIVINO',
    },
    /** Ordem dos pedaços em português (os vazios são removidos) */
    pattern: '{noun} {subtypes} {races} {attributes} {level} {names}',
    levelEq: 'de Nível {level}',
    levelMin: 'de Nível {level} ou mais',
    levelMax: 'de Nível {level} ou menos',
    or: 'ou',
    except: '(exceto {names})',
  },

  ai: {
    language: 'Brazilian Portuguese (informal “você”, casual but precise)',
    errors: {
      unusable: 'O modelo deu uma resposta inutilizável ({path}: {message}).',
      empty: 'O modelo deu uma resposta vazia.',
      timeout: 'sem resposta em {seconds} s (aumente AI_TIMEOUT_MS para um modelo local lento)',
      unreachable: 'servidor inacessível ({url}) — o servidor do modelo está rodando?',
      unavailable: 'IA indisponível: {message}',
    },
  },
};
