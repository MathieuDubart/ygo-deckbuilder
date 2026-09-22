'use client';
import type {
  CardSummaryDto,
  CreateDuelInput,
  DuelEventDto,
  DuelResponseInput,
  DuelStateDto,
} from '@ygo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { duelApi } from '@/lib/api/duel';

const DUEL_KEY = 'ygo:duel';
const SETUP_KEY = 'ygo:duel-setup';
/** Le journal garde les derniers événements seulement */
const LOG_LIMIT = 500;

export type DuelAnswer = Omit<DuelResponseInput, 'promptId'>;

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Duel en cours côté client : état renvoyé par l'API, journal et cartes citées accumulés
 * au fil des réponses. L'identifiant est gardé dans l'onglet → un rechargement reprend le duel.
 */
export function useDuelSession() {
  const [state, setState] = useState<DuelStateDto | null>(null);
  const [log, setLog] = useState<DuelEventDto[]>([]);
  const [cards, setCards] = useState<Record<string, CardSummaryDto>>({});
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [lastSetup, setLastSetup] = useState<CreateDuelInput | null>(null);
  const busyRef = useRef(false);

  const apply = useCallback((next: DuelStateDto, reset = false) => {
    setState(next);
    setLog((l) => (reset ? next.events : [...l, ...next.events]).slice(-LOG_LIMIT));
    setCards((c) => (reset ? next.cards : { ...c, ...next.cards }));
    storage()?.setItem(DUEL_KEY, next.id);
  }, []);

  const clear = useCallback(() => {
    setState(null);
    setLog([]);
    setCards({});
    storage()?.removeItem(DUEL_KEY);
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
      .then((s) => apply(s, true))
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
        const previous = state?.id;
        if (previous) await duelApi.remove(previous).catch(() => undefined);
        try {
          const next = await duelApi.create(input);
          apply(next, true);
          setLastSetup(input);
          storage()?.setItem(SETUP_KEY, JSON.stringify(input));
        } catch (e) {
          if (previous) clear();
          toast.error(e instanceof Error ? e.message : String(e));
        }
      }),
    [apply, clear, run, state?.id],
  );

  const respond = useCallback(
    (answer: DuelAnswer) =>
      run(async () => {
        if (!state?.prompt) return;
        try {
          apply(await duelApi.respond(state.id, { promptId: state.prompt.id, ...answer }));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) clear();
          else if (e instanceof ApiError && e.status === 400) {
            // Réponse refusée ou invite périmée : on se resynchronise
            await duelApi
              .get(state.id)
              .then((s) => apply(s))
              .catch(() => undefined);
          }
          toast.error(e instanceof Error ? e.message : String(e));
        }
      }),
    [apply, clear, run, state],
  );

  const leave = useCallback(
    () =>
      run(async () => {
        if (state) await duelApi.remove(state.id).catch(() => undefined);
        clear();
      }),
    [clear, run, state],
  );

  return { state, log, cards, busy, resuming, lastSetup, start, respond, leave };
}

export type DuelSession = ReturnType<typeof useDuelSession>;
