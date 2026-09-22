'use client';
import { useSyncExternalStore } from 'react';
import { setVolume } from './sound';

/** Vitesse du replay des actions : cinématique, accélérée, ou coupée (état final direct). */
export const FX_SPEEDS = ['normal', 'fast', 'off'] as const;
export type FxSpeed = (typeof FX_SPEEDS)[number];

export interface FxSettings {
  sound: boolean;
  speed: FxSpeed;
}

const KEY = 'ygo:duel-fx';
const listeners = new Set<() => void>();

function initial(): FxSettings {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fallback: FxSettings = { sound: true, speed: reduced ? 'fast' : 'normal' };
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(KEY) ?? 'null',
    ) as Partial<FxSettings> | null;
    return {
      sound: typeof saved?.sound === 'boolean' ? saved.sound : fallback.sound,
      speed: FX_SPEEDS.includes(saved?.speed as FxSpeed)
        ? (saved!.speed as FxSpeed)
        : fallback.speed,
    };
  } catch {
    return fallback;
  }
}

let current: FxSettings | null = null;
const SERVER: FxSettings = { sound: false, speed: 'normal' };

export function fxSettings(): FxSettings {
  if (typeof window === 'undefined') return SERVER;
  current ??= initial();
  return current;
}

export function setFxSettings(patch: Partial<FxSettings>): void {
  current = { ...fxSettings(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Stockage indisponible (navigation privée…) : le réglage vaut pour la session
  }
  if (patch.sound !== undefined) setVolume(patch.sound ? 0.5 : 0);
  listeners.forEach((l) => l());
}

/** Réglages partagés entre les composants (et mémorisés dans ce navigateur). */
export function useFxSettings(): FxSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    fxSettings,
    () => SERVER,
  );
}
