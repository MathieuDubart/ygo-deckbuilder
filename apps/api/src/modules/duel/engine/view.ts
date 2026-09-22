import { OcgLocation, OcgPhase, OcgPosition } from 'ocgcore-wasm';
import type { DuelCardRef, DuelLocation, DuelPhase, DuelPosition } from '@ygo/shared';

/**
 * Conversion entre les valeurs du moteur (équipes 0/1, masques de bits) et la vue du client
 * (0 = l'utilisateur, 1 = l'adversaire).
 */
export class DuelView {
  constructor(
    /** Équipe du moteur jouée par l'utilisateur (0 s'il commence, 1 sinon) */
    readonly userTeam: 0 | 1,
  ) {}

  /** Joueur du moteur → joueur vu par le client */
  player(team: number): 0 | 1 {
    return team === this.userTeam ? 0 : 1;
  }

  /** Joueur vu par le client → équipe du moteur */
  team(player: 0 | 1): 0 | 1 {
    return player === 0 ? this.userTeam : ((1 - this.userTeam) as 0 | 1);
  }

  ref(
    card: { code?: number; controller: number; location: number; sequence: number },
    hidden = false,
  ): DuelCardRef {
    return {
      controller: this.player(card.controller),
      location: toLocation(card.location),
      sequence: card.sequence,
      code: hidden ? 0 : (card.code ?? 0),
    };
  }
}

export function toLocation(location: number): DuelLocation {
  if (location & OcgLocation.OVERLAY) return 'OVERLAY';
  switch (location) {
    case OcgLocation.DECK:
      return 'DECK';
    case OcgLocation.HAND:
      return 'HAND';
    case OcgLocation.MZONE:
      return 'MZONE';
    case OcgLocation.SZONE:
    case OcgLocation.FZONE:
    case OcgLocation.PZONE:
      return 'SZONE';
    case OcgLocation.GRAVE:
      return 'GRAVE';
    case OcgLocation.REMOVED:
      return 'BANISHED';
    case OcgLocation.EXTRA:
      return 'EXTRA';
    default:
      return 'DECK';
  }
}

export function toPosition(position: number | undefined): DuelPosition | null {
  switch (position) {
    case OcgPosition.FACEUP_ATTACK:
      return 'ATK';
    case OcgPosition.FACEUP_DEFENSE:
      return 'DEF';
    case OcgPosition.FACEDOWN_ATTACK:
      return 'FD_ATK';
    case OcgPosition.FACEDOWN_DEFENSE:
      return 'FD_DEF';
    default:
      return null;
  }
}

export function fromPosition(position: DuelPosition): number {
  return {
    ATK: OcgPosition.FACEUP_ATTACK,
    DEF: OcgPosition.FACEUP_DEFENSE,
    FD_ATK: OcgPosition.FACEDOWN_ATTACK,
    FD_DEF: OcgPosition.FACEDOWN_DEFENSE,
  }[position];
}

/** Positions présentes dans un masque (ordre : ATK, DEF face recto, DEF face verso, ATK face verso). */
export function positionsIn(mask: number): DuelPosition[] {
  const out: DuelPosition[] = [];
  if (mask & OcgPosition.FACEUP_ATTACK) out.push('ATK');
  if (mask & OcgPosition.FACEUP_DEFENSE) out.push('DEF');
  if (mask & OcgPosition.FACEDOWN_DEFENSE) out.push('FD_DEF');
  if (mask & OcgPosition.FACEDOWN_ATTACK) out.push('FD_ATK');
  return out;
}

export function toPhase(phase: number): DuelPhase | null {
  switch (phase) {
    case OcgPhase.DRAW:
      return 'DRAW';
    case OcgPhase.STANDBY:
      return 'STANDBY';
    case OcgPhase.MAIN1:
      return 'MAIN1';
    case OcgPhase.BATTLE_START:
    case OcgPhase.BATTLE_STEP:
    case OcgPhase.DAMAGE:
    case OcgPhase.DAMAGE_CAL:
    case OcgPhase.BATTLE:
      return 'BATTLE';
    case OcgPhase.MAIN2:
      return 'MAIN2';
    case OcgPhase.END:
      return 'END';
    default:
      return null;
  }
}

export interface ZoneChoice {
  controller: 0 | 1;
  location: 'MZONE' | 'SZONE';
  sequence: number;
}

/**
 * Zones disponibles d'un masque SELECT_PLACE / SELECT_DISFIELD (bit à 0 = choisissable).
 * Octet 0 : Zones Monstre du joueur qui choisit (0–4 principales, 5–6 Extra), octet 1 : ses
 * Zones Magie & Piège (0–4, 5 = Terrain), octets 2–3 : pareil chez l'adversaire.
 */
export function zonesFromMask(mask: number, chooser: 0 | 1): ZoneChoice[] {
  const zones: ZoneChoice[] = [];
  const sides: [number, 0 | 1][] = [
    [0, chooser],
    [16, (1 - chooser) as 0 | 1],
  ];
  for (const [offset, controller] of sides) {
    for (let i = 0; i < 7; i++) {
      if (!(mask & (1 << (offset + i)))) zones.push({ controller, location: 'MZONE', sequence: i });
    }
    for (let i = 0; i < 6; i++) {
      if (!(mask & (1 << (offset + 8 + i))))
        zones.push({ controller, location: 'SZONE', sequence: i });
    }
  }
  return zones;
}
