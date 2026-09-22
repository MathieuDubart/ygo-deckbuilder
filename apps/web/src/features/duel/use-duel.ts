'use client';
import type {
  CardSummaryDto,
  DuelChainPrompts,
  CreateDuelInput,
  DuelEventDto,
  DuelPlayerDto,
  DuelResponseInput,
  DuelStateDto,
} from '@ygo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { duelApi } from '@/lib/api/duel';
import { fxSettings } from './fx/settings';
import { play } from './fx/sound';
import { beat, scaled } from './fx/timeline';

const DUEL_KEY = 'ygo:duel';
const SETUP_KEY = 'ygo:duel-setup';
/** Le journal garde les derniers événements seulement */
const LOG_LIMIT = 500;
/** Durée du bandeau « Duel ! » au lancement */
const START_BANNER_MS = 1200;

export type DuelAnswer = Omit<DuelResponseInput, 'promptId'>;

/** Ce que la scène affiche en ce moment (un événement rejoué, ou le lancement du duel). */
export type FxEvent = DuelEventDto | { kind: 'DUEL_START'; seq: number; turn: number };
export interface FxFrame {
  event: FxEvent;
  /** Change à chaque plan (relance les animations CSS) */
  id: number;
  /** Durée réelle du plan (ms), pour les animations */
  duration: number;
  shake: boolean;
}

const empty = (p: DuelPlayerDto): DuelPlayerDto => ({
  ...p,
  hand: [],
  monsters: p.monsters.map(() => null),
  spells: p.spells.map(() => null),
  grave: [],
  banished: [],
});

/** PV avant les événements d'une réponse (les PV finaux, moins les dégâts, plus les soins). */
function lifePointsBefore(state: DuelStateDto): [number, number] {
  const points: [number, number] = [state.players[0].lp, state.players[1].lp];
  for (const e of state.events) {
    if (e.kind === 'DAMAGE') points[e.player] += e.amount;
    if (e.kind === 'RECOVER') points[e.player] -= e.amount;
  }
  return points;
}

/** Le duel avant la première action : mains et Terrain vides. */
function emptyBoard(state: DuelStateDto): DuelStateDto {
  return {
    ...state,
    chain: [],
    prompt: null,
    players: [empty(state.players[0]), empty(state.players[1])],
  };
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Duel en cours côté client : état renvoyé par l'API, journal et cartes citées accumulés.
 * Chaque réponse est **rejouée** : le terrain reste figé sur l'état précédent pendant que ses
 * événements (Invocations, activations, attaques, dégâts…) passent un par un à l'écran,
 * puis le nouvel état s'affiche. L'identifiant est gardé dans l'onglet → un rechargement
 * reprend le duel.
 */
export function useDuelSession() {
  const [state, setState] = useState<DuelStateDto | null>(null);
  const [log, setLog] = useState<DuelEventDto[]>([]);
  const [cards, setCards] = useState<Record<string, CardSummaryDto>>({});
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [lastSetup, setLastSetup] = useState<CreateDuelInput | null>(null);
  /** Replay en cours */
  const [playing, setPlaying] = useState(false);
  const [fx, setFx] = useState<FxFrame | null>(null);
  /** PV affichés pendant le replay (les dégâts défilent avant le nouvel état) */
  const [lp, setLp] = useState<[number, number] | null>(null);
  const busyRef = useRef(false);
  const stateRef = useRef<DuelStateDto | null>(null);
  const skipRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const frameRef = useRef(0);

  const show = useCallback((next: DuelStateDto | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Attente interruptible (« Passer » réveille tout de suite). */
  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        if (skipRef.current || ms <= 0) return resolve();
        const timer = setTimeout(done, ms);
        function done() {
          clearTimeout(timer);
          wakeRef.current = null;
          resolve();
        }
        wakeRef.current = done;
      }),
    [],
  );

  /** Rejoue des événements : journal au fil de l'eau, plans, bruitages, PV qui défilent. */
  const replay = useCallback(
    async (events: DuelEventDto[], from: [number, number]) => {
      const { speed, sound } = fxSettings();
      const points: [number, number] = [...from];
      // « Passer » pendant le bandeau de lancement vaut aussi pour la suite
      skipRef.current ||= speed === 'off';
      setPlaying(true);
      setLp(points);
      for (const e of events) {
        setLog((l) => [...l, e].slice(-LOG_LIMIT));
        if (e.kind === 'DAMAGE') points[e.player] = Math.max(0, points[e.player] - e.amount);
        if (e.kind === 'RECOVER') points[e.player] += e.amount;
        if (e.kind === 'DAMAGE' || e.kind === 'RECOVER') setLp([...points]);
        // Vibration sur mobile quand tu prends des dégâts
        if (e.kind === 'DAMAGE' && e.player === 0 && !e.cost && !skipRef.current)
          navigator.vibrate?.(e.amount >= 1000 ? [60, 40, 90] : 50);
        if (skipRef.current) continue;
        const b = beat(e);
        const duration = scaled(b.duration, speed);
        if (!duration) continue;
        if (sound && b.sfx) play(b.sfx);
        setFx({ event: e, id: ++frameRef.current, duration, shake: b.shake });
        await wait(duration);
      }
      setFx(null);
      setLp(null);
      setPlaying(false);
      skipRef.current = false;
    },
    [wait],
  );

  /**
   * Nouvel état de l'API. `resume` : affichage direct (rechargement de la page) ;
   * `start` : le duel s'affiche puis ses premiers événements défilent ; sinon replay depuis
   * l'état affiché, puis le nouvel état.
   */
  const apply = useCallback(
    async (next: DuelStateDto, mode: 'resume' | 'start' | 'step' = 'step') => {
      setCards((c) => (mode === 'step' ? { ...c, ...next.cards } : next.cards));
      storage()?.setItem(DUEL_KEY, next.id);
      if (mode === 'resume') {
        show(next);
        setLog(next.events.slice(-LOG_LIMIT));
        return;
      }
      if (mode === 'start') {
        // Si l'adversaire a déjà joué son premier tour, on part d'un terrain vide pour ne
        // pas dévoiler la fin du replay
        const acted = next.events.some(
          (e) => e.kind === 'SUMMON' || e.kind === 'SET' || e.kind === 'ACTIVATE',
        );
        show(acted ? emptyBoard(next) : next);
        setLog([]);
        const { speed, sound } = fxSettings();
        if (speed !== 'off') {
          if (sound) play('turn');
          setFx({
            event: { kind: 'DUEL_START', seq: 0, turn: 0 },
            id: ++frameRef.current,
            duration: scaled(START_BANNER_MS, speed),
            shake: false,
          });
          setPlaying(true);
          await wait(scaled(START_BANNER_MS, speed));
        }
        await replay(next.events, lifePointsBefore(next));
        show(next);
        return;
      }
      const prev = stateRef.current;
      const from: [number, number] = prev
        ? [prev.players[0].lp, prev.players[1].lp]
        : [next.players[0].lp, next.players[1].lp];
      await replay(next.events, from);
      show(next);
    },
    [replay, show, wait],
  );

  const clear = useCallback(() => {
    show(null);
    setLog([]);
    setCards({});
    storage()?.removeItem(DUEL_KEY);
  }, [show]);

  /** Coupe le replay en cours : les événements restants vont directement au journal. */
  const skip = useCallback(() => {
    skipRef.current = true;
    wakeRef.current?.();
  }, []);

  // Reprise après rechargement
  useEffect(() => {
    const id = storage()?.getItem(DUEL_KEY);
    const setup = storage()?.getItem(SETUP_KEY);
    if (setup) {
      try {
        setLastSetup(JSON.parse(setup) as CreateDuelInput);
      } catch {
        storage()?.removeItem(SETUP_KEY);
      }
    }
    if (!id) {
      setResuming(false);
      return;
    }
    duelApi
      .get(id)
      .then((s) => apply(s, 'resume'))
      .catch(() => storage()?.removeItem(DUEL_KEY))
      .finally(() => setResuming(false));
  }, [apply]);

  const run = useCallback(async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    (input: CreateDuelInput) =>
      run(async () => {
        const previous = stateRef.current?.id;
        if (previous) await duelApi.remove(previous).catch(() => undefined);
        try {
          const next = await duelApi.create(input);
          setLastSetup(input);
          storage()?.setItem(SETUP_KEY, JSON.stringify(input));
          await apply(next, 'start');
        } catch (e) {
          if (previous) clear();
          toast.error(e instanceof Error ? e.message : String(e));
        }
      }),
    [apply, clear, run],
  );

  const respond = useCallback(
    (answer: DuelAnswer) =>
      run(async () => {
        const current = stateRef.current;
        if (!current?.prompt) return;
        if (fxSettings().sound) play('select');
        try {
          await apply(
            await duelApi.respond(current.id, { promptId: current.prompt.id, ...answer }),
          );
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) clear();
          else if (e instanceof ApiError && e.status === 400) {
            // Réponse refusée ou invite périmée : on se resynchronise
            await duelApi
              .get(current.id)
              .then((s) => apply(s, 'resume'))
              .catch(() => undefined);
          }
          toast.error(e instanceof Error ? e.message : String(e));
        }
      }),
    [apply, clear, run],
  );

  const setChainPrompts = useCallback(
    (chainPrompts: DuelChainPrompts) =>
      run(async () => {
        const current = stateRef.current;
        if (!current) return;
        try {
          await apply(await duelApi.settings(current.id, { chainPrompts }));
          // « Recommencer » garde le réglage
          setLastSetup((setup) => {
            if (!setup) return setup;
            const next = { ...setup, chainPrompts };
            storage()?.setItem(SETUP_KEY, JSON.stringify(next));
            return next;
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e));
        }
      }),
    [apply, run],
  );

  const leave = useCallback(
    () =>
      run(async () => {
        const current = stateRef.current;
        if (current) await duelApi.remove(current.id).catch(() => undefined);
        clear();
      }),
    [clear, run],
  );

  return {
    state,
    log,
    cards,
    busy,
    resuming,
    lastSetup,
    playing,
    fx,
    lp,
    start,
    respond,
    leave,
    skip,
    setChainPrompts,
  };
}

export type DuelSession = ReturnType<typeof useDuelSession>;
