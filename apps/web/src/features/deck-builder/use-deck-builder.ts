'use client';
import {
  DECK_RULES,
  maxCopiesFor,
  validateDeck,
  type CardSummaryDto,
  type DeckDto,
  type DeckZone,
} from '@ygo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateDeck } from '@/lib/api/decks';

export interface BuilderEntry {
  card: CardSummaryDto;
  zone: DeckZone;
  quantity: number;
  owned: number;
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

const key = (zone: DeckZone, cardId: number) => `${zone}:${cardId}`;

/**
 * État local du builder : édition instantanée (optimiste), validation live via les règles
 * partagées, et sauvegarde automatique debouncée vers l'API.
 */
export function useDeckBuilder(deck: DeckDto) {
  const update = useUpdateDeck(deck.id);
  const [entries, setEntries] = useState<Map<string, BuilderEntry>>(() => fromDeck(deck));
  const [status, setStatus] = useState<SaveStatus>('saved');
  const version = useRef(0);

  const list = useMemo(() => [...entries.values()], [entries]);

  const byZone = useMemo(() => {
    const z: Record<DeckZone, BuilderEntry[]> = { MAIN: [], EXTRA: [], SIDE: [] };
    for (const e of list) z[e.zone].push(e);
    for (const zone of Object.values(z)) zone.sort(compareEntries);
    return z;
  }, [list]);

  const counts = useMemo(
    () => ({
      MAIN: sum(byZone.MAIN),
      EXTRA: sum(byZone.EXTRA),
      SIDE: sum(byZone.SIDE),
    }),
    [byZone],
  );

  const issues = useMemo(
    () =>
      validateDeck(
        list.map((e) => ({
          cardId: e.card.id,
          zone: e.zone,
          quantity: e.quantity,
          isExtraDeckMonster: e.card.isExtraDeck,
          banStatus: deck.format === 'OCG' ? null : e.card.banTcg,
        })),
      ),
    [list, deck.format],
  );

  const totalCopiesOf = useCallback(
    (cardId: number) =>
      list.filter((e) => e.card.id === cardId).reduce((s, e) => s + e.quantity, 0),
    [list],
  );

  /** Ajoute 1 exemplaire. Zone par défaut : EXTRA pour les monstres extra, sinon MAIN. */
  const add = useCallback(
    (card: CardSummaryDto, zone?: DeckZone): { ok: boolean; reason?: string } => {
      const target: DeckZone = zone ?? (card.isExtraDeck ? 'EXTRA' : 'MAIN');
      if (target === 'MAIN' && card.isExtraDeck)
        return { ok: false, reason: 'Ce monstre va dans l’Extra Deck' };
      if (target === 'EXTRA' && !card.isExtraDeck)
        return { ok: false, reason: 'Seuls les monstres Fusion/Synchro/Xyz/Link vont en Extra' };
      const limit = deck.format === 'OCG' ? DECK_RULES.MAX_COPIES : maxCopiesFor(card.banTcg);
      if (totalCopiesOf(card.id) >= limit)
        return { ok: false, reason: `Maximum ${limit} exemplaire(s)` };
      if (counts[target] >= DECK_RULES[target].max) return { ok: false, reason: `${target} plein` };

      setEntries((prev) => {
        const next = new Map(prev);
        const k = key(target, card.id);
        const cur = next.get(k);
        next.set(k, {
          card,
          zone: target,
          quantity: (cur?.quantity ?? 0) + 1,
          owned: card.ownedQuantity ?? cur?.owned ?? 0,
        });
        return next;
      });
      return { ok: true };
    },
    [counts, deck.format, totalCopiesOf],
  );

  const removeOne = useCallback((zone: DeckZone, cardId: number) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const k = key(zone, cardId);
      const cur = next.get(k);
      if (!cur) return prev;
      if (cur.quantity <= 1) next.delete(k);
      else next.set(k, { ...cur, quantity: cur.quantity - 1 });
      return next;
    });
  }, []);

  // Sauvegarde auto 800 ms après la dernière modif
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus('dirty');
    const v = ++version.current;
    const t = setTimeout(() => {
      setStatus('saving');
      update.mutate(
        { cards: list.map((e) => ({ cardId: e.card.id, zone: e.zone, quantity: e.quantity })) },
        {
          onSuccess: () => v === version.current && setStatus('saved'),
          onError: () => v === version.current && setStatus('error'),
        },
      );
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const missing = useMemo(() => {
    const need = new Map<number, { card: CardSummaryDto; required: number; owned: number }>();
    for (const e of list) {
      const cur = need.get(e.card.id);
      need.set(e.card.id, {
        card: e.card,
        required: (cur?.required ?? 0) + e.quantity,
        owned: e.owned,
      });
    }
    return [...need.values()]
      .filter((n) => n.required > n.owned)
      .map((n) => ({ ...n, missing: n.required - n.owned }));
  }, [list]);

  return {
    byZone,
    counts,
    issues,
    add,
    removeOne,
    status,
    missing,
    retry: () => setEntries((e) => new Map(e)),
  };
}

function fromDeck(deck: DeckDto): Map<string, BuilderEntry> {
  return new Map(
    deck.cards.map((c) => [
      key(c.zone, c.cardId),
      { card: c.card, zone: c.zone, quantity: c.quantity, owned: c.ownedQuantity },
    ]),
  );
}

const sum = (xs: BuilderEntry[]) => xs.reduce((s, e) => s + e.quantity, 0);

const CATEGORY_ORDER = { MONSTER: 0, SPELL: 1, TRAP: 2, SKILL: 3, TOKEN: 4 } as const;
function compareEntries(a: BuilderEntry, b: BuilderEntry) {
  return (
    CATEGORY_ORDER[a.card.category] - CATEGORY_ORDER[b.card.category] ||
    (b.card.level ?? 0) - (a.card.level ?? 0) ||
    a.card.name.localeCompare(b.card.name)
  );
}
