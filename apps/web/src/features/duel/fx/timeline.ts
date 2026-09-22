import type { DuelEventDto } from '@ygo/shared';
import type { Sfx } from './sound';
import type { FxSpeed } from './settings';

/** Ce que le replay fait d'un événement : durée à l'écran, bruitage, secousse. */
export interface Beat {
  /** ms à vitesse normale ; 0 = seulement ajouté au journal */
  duration: number;
  sfx: Sfx | null;
  shake: boolean;
  /** Mis en scène au centre du terrain (sinon : effet discret) */
  cutIn: boolean;
}

const SPEED: Record<FxSpeed, number> = { normal: 1, fast: 0.45, off: 0 };

export function beat(e: DuelEventDto): Beat {
  const b = (duration: number, sfx: Sfx | null, cutIn = true, shake = false): Beat => ({
    duration,
    sfx,
    shake,
    cutIn,
  });
  switch (e.kind) {
    case 'TURN':
      return b(1300, 'turn');
    case 'PHASE':
      // Draw / Standby Phase : juste un tic
      return e.phase === 'DRAW' || e.phase === 'STANDBY'
        ? b(0, null, false)
        : b(420, 'phase', false);
    case 'DRAW':
      return b(e.player === 0 ? 380 : 220, 'draw', false);
    case 'SUMMON':
      return b(e.how === 'SPECIAL' ? 1300 : 1100, e.how === 'SPECIAL' ? 'special' : 'summon');
    case 'SET':
      return b(450, 'set', false);
    case 'ACTIVATE':
      return b(1250, 'activate');
    case 'CHAIN_NEGATED':
      return b(850, 'negate');
    case 'MOVE':
      return e.to === 'GRAVE' || e.to === 'BANISHED' ? b(560, 'move', false) : b(0, null, false);
    case 'ATTACK':
      return b(950, 'attack');
    case 'DAMAGE':
      return b(e.cost ? 600 : 950, e.cost ? 'move' : 'damage', false, !e.cost && e.amount >= 500);
    case 'RECOVER':
      return b(750, 'recover', false);
    case 'COIN':
    case 'DICE':
      return b(1100, 'coin');
    case 'WIN':
      return b(0, null, false);
  }
}

export function scaled(duration: number, speed: FxSpeed): number {
  return Math.round(duration * SPEED[speed]);
}
